import { Result } from "../../targets/result";
import { MaybeValue, SyncFromTargets, SyncOperation, SyncOperationLogger, Targets, Value } from "../types";
import { getBufferFromValue, getValueFromBuffer } from "./serialisation";

// Exported only for tests
export const runWithLogger = <S, T extends Targets>(
    logger: () => SyncOperationLogger<SyncFromTargets<T>>,
    sync: SyncFromTargets<T>,
    operation: SyncOperation,
    runner: () => Result<S>
): Result<S> => {
    if (!sync.target.online()) {
        logger()({ sync, operation, stage: "OFFLINE" });
        return Result.error();
    }

    logger()({ sync, operation, stage: "START" });
    const promise = runner();

    promise.then(({ type }) => logger()({ sync, operation, stage: type === "value" ? "SUCCESS" : "ERROR" }));

    return promise;
};

export const timestampFromSync = <T extends Targets>(
    logger: () => SyncOperationLogger<SyncFromTargets<T>>,
    sync: SyncFromTargets<T>
): Result<Date | null> => runWithLogger(logger, sync, "POLL", () => sync.target.timestamp());

export const readFromSync = <V extends Value, T extends Targets>(
    logger: () => SyncOperationLogger<SyncFromTargets<T>>,
    sync: SyncFromTargets<T>
): Result<MaybeValue<V>> =>
    runWithLogger(logger, sync, "DOWNLOAD", () =>
        sync.target.read().pmap(
            async (value) =>
                value && {
                    timestamp: value.timestamp,
                    value: await getValueFromBuffer<V>(value.buffer, sync.compressed),
                }
        )
    );

export const writeToAndUpdateSync = async <V extends Value, T extends Targets>(
    logger: () => SyncOperationLogger<SyncFromTargets<T>>,
    sync: SyncFromTargets<T>,
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
