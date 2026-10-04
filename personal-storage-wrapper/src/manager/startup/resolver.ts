import { Target } from "../../targets";
import { ResultValueType } from "../../targets/result";
import { deepEquals } from "../../utilities/data";
import {
    ConflictingSyncStartupBehaviour,
    MaybeValue,
    Sync,
    SyncOperationLogger,
    TimestampedValue,
    Value,
} from "../types";
import { writeToAndUpdateSync } from "../utilities/requests";

interface StartupResult<V extends Value, T extends Target<any, any>> {
    sync: Sync<T>;
    result: ResultValueType<MaybeValue<V>>;
}

/**
 * The value to hold once every target has been read. If a target disagrees with the value the manager
 * started with, the handler decides; otherwise it is the value the manager holds now, which may have been
 * changed while the targets were read.
 */
export const resolveInitialSyncValues = async <V extends Value, T extends Target<any, any>>(
    value: V,
    getValue: () => V,
    results: StartupResult<V, T>[],
    resolveConflictingSyncValuesOnStartup: ConflictingSyncStartupBehaviour<V, T>
): Promise<V> => {
    if (!results.some(({ result }) => result.value && !deepEquals(result.value?.value, value))) return getValue();

    const syncsWithValues = results
        .filter(({ result }) => result.type === "value" && result.value !== null)
        .map(({ sync, result }) => ({ sync, value: result.value as TimestampedValue<V> }));

    return resolveConflictingSyncValuesOnStartup(value, getValue, syncsWithValues);
};

/** Writes the value to every target that was read and holds something else, or nothing */
export const writeInitialSyncValues = <V extends Value, T extends Target<any, any>>(
    value: V,
    results: StartupResult<V, T>[],
    logger: () => SyncOperationLogger<Sync<T>>
) =>
    Promise.all(
        results.map(async ({ sync, result }) => {
            if (result.type === "value" && !deepEquals(result.value?.value, value)) {
                await writeToAndUpdateSync(logger, sync, value);
            } else if (result.type === "value" && result.value) {
                sync.lastSeenWriteTime = result.value.timestamp;
            }
        })
    );
