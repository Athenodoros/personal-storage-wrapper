import { deepEquals, uniqBy } from "../../utilities/data";
import { ConflictingRemoteBehaviour, SyncFromTargets, Targets, Value } from "../types";
import { readFromSync } from "../utilities/requests";
import { OperationRunConfig, OperationRunOutput } from "./types";

export const AdditionOperationRunner = async <V extends Value, T extends Targets>({
    args,
    syncs,
    logger,
    value,
    config,
}: OperationRunConfig<V, T, SyncFromTargets<T>>): Promise<OperationRunOutput<V, T>> => {
    let additions = uniqBy(args, (sync) => sync.target).filter((addition) =>
        syncs.every((sync) => sync.target !== addition.target)
    );
    if (additions.length === 0) return {};

    let writes: SyncFromTargets<T>[] = [];
    let update: OperationRunOutput<V, T>["update"];

    const conflicts: Parameters<ConflictingRemoteBehaviour<T, V>>[2] = [];
    await Promise.all(
        additions.map((sync) =>
            readFromSync<V, T>(logger, sync).then(async (result) => {
                if (result.type === "error") {
                    sync.desynced = true;
                } else if (result.value === null) {
                    writes.push(sync);
                } else if (!deepEquals(result.value.value, value)) {
                    conflicts.push({ sync, value: result.value });
                }
                // else - sync already has correct value
            })
        )
    );
    if (conflicts.length) {
        const newValue = await config.resolveConflictingSyncsUpdate(value, syncs, conflicts);

        if (!deepEquals(newValue, value)) {
            update = { value: newValue, origin: "CONFLICT" };
            writes.push(...syncs);
        }

        conflicts.forEach((conflict) => {
            if (!deepEquals(conflict.value.value, newValue)) {
                writes.push(conflict.sync);
            }
        });
    }

    return {
        syncs: syncs.concat(additions),
        update,
        writes,
    };
};
