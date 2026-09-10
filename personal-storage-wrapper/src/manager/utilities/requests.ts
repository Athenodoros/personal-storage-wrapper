import { Target } from "../../targets";
import { Result } from "../../targets/result";
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
): Result<MaybeValue<V>> =>
    target.read().pmap(
        async (value) =>
            value &&
            ({
                timestamp: value.timestamp,
                value: await getValueFromBuffer<V>(value.buffer, compressed),
            } as MaybeValue<V>)
    );

export const readFromSync = <V extends Value, T extends Target<any, any>>(
    logger: () => SyncOperationLogger<Sync<T>>,
    sync: Sync<T>
): Result<MaybeValue<V>> =>
    runWithLogger(logger, sync, "DOWNLOAD", () =>
        sync.target.read().pmap(
            async (value) =>
                value &&
                ({
                    timestamp: value.timestamp,
                    value: await getValueFromBuffer<V>(value.buffer, sync.compressed),
                } as MaybeValue<V>)
        )
    );

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
