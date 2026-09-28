import { Target } from "../../targets";
import { ErrorResult, getErrorDetail, Result } from "../../targets/result";
import { MaybeValue, Sync, SyncOperation, SyncOperationLogger, UnreadableValueSource, Value } from "../types";
import { getBufferFromValue, getValueFromBuffer } from "./serialisation";

// Exported only for tests
export const runWithLogger = <S, T extends Target<any, any>>(
    logger: () => SyncOperationLogger<Sync<T>>,
    sync: Sync<T>,
    operation: SyncOperation,
    runner: () => Result<S>
): Result<S> => {
    if (!sync.target.online()) {
        logger()({ sync, operation, stage: "OFFLINE" });
        return Result.error("OFFLINE");
    }

    logger()({ sync, operation, stage: "START" });
    const promise = runner();

    promise.then(({ type }) => logger()({ sync, operation, stage: type === "value" ? "SUCCESS" : "ERROR" }));

    return promise;
};

/**
 * Whether something else has written to a target since this sync last wrote to or read from it. Times
 * are compared rather than Dates: targets build a fresh Date on every call, and a lastSeenWriteTime
 * restored from storage is a string until it is revived. An empty target has not moved on.
 */
export const hasMovedOn = <T extends Target<any, any>>(sync: Sync<T>, timestamp: Date | null) =>
    timestamp !== null &&
    (sync.lastSeenWriteTime === undefined || timestamp.valueOf() !== new Date(sync.lastSeenWriteTime).valueOf());

export const timestampFromSync = <T extends Target<any, any>>(
    logger: () => SyncOperationLogger<Sync<T>>,
    sync: Sync<T>
): Result<Date | null> => runWithLogger(logger, sync, "POLL", () => sync.target.timestamp());

/**
 * What a read checks a value against once it is decoded, and who to tell when it is refused. Both are
 * optional, so that a read with neither accepts anything that decodes.
 */
export interface ReadChecks<T extends Target<any, any>> {
    validate?: (value: unknown) => string | null;
    onUnreadableValue?: (error: ErrorResult, source: UnreadableValueSource<T>) => void;
}

/**
 * Reads a target without adding it to anything, for an application that wants to know what is
 * already in a target before it decides whether to sync to it at all.
 *
 * `addTarget` reconciles the target with the value the manager is holding, and by the time the
 * conflict handler runs the decision to sync is already made. Somewhere like a "link this account"
 * button, the answer is sometimes that the two should not be joined up at all - and that has to be
 * settled before anything is written anywhere.
 */
export const readValueFromTarget = <V extends Value, T extends Target<any, any>>(
    target: T,
    compressed: boolean = true,
    validate?: (value: unknown) => string | null
): Result<MaybeValue<V>> => decodeTargetValue(target.read(), compressed, validate);

/**
 * Reads a sync, and records on it whether what it holds can be used: a value that won't decode or
 * fails validation marks it `unreadable`, so that nothing is written over it, and a usable value or
 * an empty target clears that again. A target that can't be reached says nothing either way.
 *
 * An unreadable value has still been seen, so its timestamp is recorded as one: polls then leave the
 * target alone, rather than reading and reporting the same value again each time, until something
 * writes to it.
 */
export const readFromSync = <V extends Value, T extends Target<any, any>>(
    logger: () => SyncOperationLogger<Sync<T>>,
    sync: Sync<T>,
    checks: ReadChecks<T> = {}
): Result<MaybeValue<V>> =>
    new Result((resolve) =>
        runWithLogger(logger, sync, "DOWNLOAD", () =>
            decodeTargetValue<V>(sync.target.read(), sync.compressed, checks.validate)
        ).then((result) => {
            if (result.type === "value") sync.unreadable = false;
            else if (result.error === "CORRUPT_VALUE") {
                sync.unreadable = true;
                // `hasMovedOn` reads this as the last write from here, so a desynced unreadable sync
                // looks untouched and is picked for a write - which is only safe because
                // `writeToAndUpdateSync` refuses every write to an unreadable sync
                if (result.timestamp) sync.lastSeenWriteTime = result.timestamp;
                reportUnreadableValue(checks.onUnreadableValue, result, { type: "SYNC", sync });
            }

            resolve(result);
        })
    );

/**
 * The handler is application code, and can throw. Anything it throws is logged rather than passed
 * on: a read that threw here would never resolve, and startup or the operation queue would wait on
 * it for good.
 */
export const reportUnreadableValue = <T extends Target<any, any>>(
    onUnreadableValue: ReadChecks<T>["onUnreadableValue"],
    error: ErrorResult,
    source: UnreadableValueSource<T>
) => {
    try {
        onUnreadableValue?.(error, source);
    } catch (thrown) {
        console.error("PersonalStorageManager: onUnreadableValue threw", thrown);
    }
};

/** A successful target read and a failed decode are distinct from a target that could not be reached. */
const decodeTargetValue = <V extends Value>(
    read: ReturnType<Target<any, any>["read"]>,
    compressed: boolean,
    validate?: (value: unknown) => string | null
) =>
    new Result<MaybeValue<V>>((resolve) => {
        read.then(async (result) => {
            if (result.type === "error") return resolve(result);
            if (result.value === null) return resolve({ type: "value", value: null });

            const { buffer, timestamp } = result.value;

            let value: V;
            try {
                value = await getValueFromBuffer<V>(buffer, compressed);
            } catch (thrown) {
                return resolve({
                    type: "error",
                    error: "CORRUPT_VALUE",
                    detail: getErrorDetail(thrown),
                    buffer,
                    timestamp,
                });
            }

            const problem = getValidationProblem(value, validate);
            if (problem !== null)
                return resolve({
                    type: "error",
                    error: "CORRUPT_VALUE",
                    detail: problem,
                    buffer,
                    decoded: value,
                    timestamp,
                });

            resolve({ type: "value", value: { timestamp, value } });
        });
    });

/** Why a value fails validation, or null if it passes. A validator that throws is taken as a refusal. */
export const getValidationProblem = (value: unknown, validate?: (value: unknown) => string | null) => {
    if (!validate) return null;

    try {
        return validate(value);
    } catch (thrown) {
        return getErrorDetail(thrown) ?? "The value failed validation";
    }
};

/**
 * Writes the value, and says whether it was saved. A sync holding a value that couldn't be read is
 * never written to, so that the value is still there for the application to deal with.
 */
export const writeToAndUpdateSync = async <V extends Value, T extends Target<any, any>>(
    logger: () => SyncOperationLogger<Sync<T>>,
    sync: Sync<T>,
    value: V
): Promise<boolean> => {
    if (sync.unreadable) return false;

    const buffer = await getBufferFromValue(value, sync.compressed);
    const result = await runWithLogger(logger, sync, "UPLOAD", () => sync.target.write(buffer));

    if (result.type === "value") {
        sync.desynced = false;
        sync.lastSeenWriteTime = result.value;
        return true;
    }

    sync.desynced = true;
    return false;
};
