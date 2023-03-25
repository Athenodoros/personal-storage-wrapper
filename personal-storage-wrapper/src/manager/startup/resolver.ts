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
import { writeToSync } from "../utilities/requests";

type InitialSyncProcessingResult<V extends Value> = {
    value: V;
    didUpdateSyncs: boolean;
};

export const handleInitialSyncValuesAndGetResult = async <V extends Value, T extends Targets = DefaultTargetsType>(
    value: V,
    results: {
        sync: SyncFromTargets<T>;
        result: ResultValueType<MaybeValue<V>>;
    }[],
    resolveConflictingSyncValuesOnStartup: ConflictingSyncStartupBehaviour<T, V>,
    logger: () => SyncOperationLogger<SyncFromTargets<T>>
): Promise<InitialSyncProcessingResult<V>> => {
    let didUpdateSyncs = false;

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
                const result = await writeToSync(logger)(sync, value);
                if (result.type === "error") {
                    if (sync.desynced === false) didUpdateSyncs = true;

                    sync.desynced = true;
                } else {
                    didUpdateSyncs = true;

                    sync.desynced = false;
                    sync.lastSeenWriteTime = result.value;
                }
            }
        })
    );

    // Return result
    return { value, didUpdateSyncs };
};
