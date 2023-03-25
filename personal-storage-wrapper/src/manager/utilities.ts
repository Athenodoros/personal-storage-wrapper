import { Result } from "../targets/result";
import { getBufferFromValue, getValueFromBuffer } from "./serialisation";
import { MaybeValue, SyncFromTargets, SyncOperation, SyncOperationLogger, Targets, Value } from "./types";

const runWithLogger = <S, T extends Targets>(
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

export const readFromSync =
    <V extends Value, T extends Targets>(logger: () => SyncOperationLogger<SyncFromTargets<T>>) =>
    (sync: SyncFromTargets<T>): Result<MaybeValue<V>> =>
        runWithLogger(logger, sync, "DOWNLOAD", () =>
            sync.target
                .read()
                .map((value) => value && { timestamp: value.timestamp, value: getValueFromBuffer<V>(value.buffer) })
        );

export const writeToSync =
    <V extends Value, T extends Targets>(logger: () => SyncOperationLogger<SyncFromTargets<T>>) =>
    (sync: SyncFromTargets<T>, value: V): Result<Date> =>
        runWithLogger(logger, sync, "UPLOAD", () => sync.target.write(getBufferFromValue(value)));

export const timestampFromSync =
    <T extends Targets>(logger: () => SyncOperationLogger<SyncFromTargets<T>>) =>
    (sync: SyncFromTargets<T>): Result<Date | null> =>
        runWithLogger(logger, sync, "POLL", () => sync.target.timestamp());
