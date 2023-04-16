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
import {} from "../utilities/defaults";
import { writeToAndUpdateSync } from "../utilities/requests";

export const handleInitialSyncValuesAndGetResult = async <V extends Value, T extends Target<any, any>>(
    value: V,
    getValue: () => V,
    results: {
        sync: Sync<T>;
        result: ResultValueType<MaybeValue<V>>;
    }[],
    resolveConflictingSyncValuesOnStartup: ConflictingSyncStartupBehaviour<V, T>,
    logger: () => SyncOperationLogger<Sync<T>>
): Promise<V> => {
    // If conflict or out of date sync, update value using callback
    if (results.some(({ result }) => result.value && !deepEquals(result.value?.value, value))) {
        const syncsWithValues = results
            .filter(({ result }) => result.type === "value" && result.value !== null)
            .map(({ sync, result }) => ({ sync, value: result.value as TimestampedValue<V> }));

        value = await resolveConflictingSyncValuesOnStartup(value, getValue(), syncsWithValues);
    }

    // If any missing or updated, write back
    await Promise.all(
        results.map(async ({ sync, result }) => {
            if (result.type === "value" && !deepEquals(result.value?.value, value)) {
                await writeToAndUpdateSync(logger, sync, value);
            } else if (result.type === "value" && result.value) {
                sync.lastSeenWriteTime = result.value.timestamp;
            }
        })
    );

    // Return result
    return value;
};
