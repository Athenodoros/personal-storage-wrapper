import { Target } from "../../targets";
import { getErrorDetail, Result } from "../../targets/result";
import { MaybeValue, Sync, SyncOperation, SyncOperationLogger, Value } from "../types";
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

export const timestampFromSync = <T extends Target<any, any>>(
    logger: () => SyncOperationLogger<Sync<T>>,
    sync: Sync<T>
): Result<Date | null> => runWithLogger(logger, sync, "POLL", () => sync.target.timestamp());

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
    compressed: boolean = true
): Result<MaybeValue<V>> => decodeTargetValue(target.read(), compressed);

export const readFromSync = <V extends Value, T extends Target<any, any>>(
    logger: () => SyncOperationLogger<Sync<T>>,
    sync: Sync<T>
): Result<MaybeValue<V>> =>
    runWithLogger(logger, sync, "DOWNLOAD", () => decodeTargetValue(sync.target.read(), sync.compressed));

/** A successful target read and a failed decode are distinct from a target that could not be reached. */
const decodeTargetValue = <V extends Value>(read: ReturnType<Target<any, any>["read"]>, compressed: boolean) =>
    new Result<MaybeValue<V>>((resolve) => {
        read.then(async (result) => {
            if (result.type === "error") return resolve(result);
            if (result.value === null) return resolve({ type: "value", value: null });

            try {
                resolve({
                    type: "value",
                    value: {
                        timestamp: result.value.timestamp,
                        value: await getValueFromBuffer<V>(result.value.buffer, compressed),
                    },
                });
            } catch (thrown) {
                resolve({ type: "error", error: "CORRUPT_VALUE", detail: getErrorDetail(thrown) });
            }
        });
    });

export const writeToAndUpdateSync = async <V extends Value, T extends Target<any, any>>(
    logger: () => SyncOperationLogger<Sync<T>>,
    sync: Sync<T>,
    value: V
): Promise<void> => {
    const buffer = await getBufferFromValue(value, sync.compressed);
    const result = await runWithLogger(logger, sync, "UPLOAD", () => sync.target.write(buffer));

    if (result.type === "value") {
        sync.desynced = false;
        sync.lastSeenWriteTime = result.value;
    } else {
        sync.desynced = true;
    }
};
