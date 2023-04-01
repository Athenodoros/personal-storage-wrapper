import { ResultValueType } from "../../targets/result";
import { deepEquals } from "../../utilities/data";
import {
    ConflictingSyncStartupBehaviour,
    MaybeValue,
    SyncFromTargets,
    SyncOperationLogger,
    Targets,
    TimestampedValue,
    Value,
} from "../types";
import { DefaultTargetsType } from "../utilities/defaults";
import { writeToAndUpdateSync } from "../utilities/requests";

export const handleInitialSyncValuesAndGetResult = async <V extends Value, T extends Targets = DefaultTargetsType>(
    value: V,
    results: {
        sync: SyncFromTargets<T>;
        result: ResultValueType<MaybeValue<V>>;
    }[],
    resolveConflictingSyncValuesOnStartup: ConflictingSyncStartupBehaviour<T, V>,
    logger: () => SyncOperationLogger<SyncFromTargets<T>>
): Promise<V> => {
    // If conflict or out of date sync, update value using callback
    if (results.some(({ result }) => result.value && !deepEquals(result.value?.value, value))) {
        const syncsWithValues = results
            .filter(({ result }) => result.type === "value" && result.value !== null)
            .map(({ sync, result }) => ({ sync, value: result.value as TimestampedValue<V> }));

        value = await resolveConflictingSyncValuesOnStartup(syncsWithValues);
    }

    // If any missing or updated, write back
    await Promise.all(
        results.map(async ({ sync, result }) => {
            if (result.type === "value" && !deepEquals(result.value?.value, value)) {
                await writeToAndUpdateSync(logger, sync, value);
            }
        })
    );

    // Return result
    return value;
};
