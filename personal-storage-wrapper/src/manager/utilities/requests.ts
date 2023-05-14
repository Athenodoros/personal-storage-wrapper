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
