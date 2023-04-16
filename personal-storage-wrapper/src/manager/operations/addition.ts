import { Target } from "../../targets";
import { deepEquals, uniqEquals } from "../../utilities/data";
import { ConflictingRemoteBehaviour, Sync, Value } from "../types";
import { readFromSync } from "../utilities/requests";
import { OperationRunConfig, OperationRunOutput } from "./types";

export const AdditionOperationRunner = async <V extends Value, T extends Target<any, any>>({
    args,
    syncs,
    logger,
    value,
    config,
}: OperationRunConfig<V, T, Sync<T>>): Promise<OperationRunOutput<V, T>> => {
    let additions = uniqEquals(args, (s1, s2) => s1.target.equals(s2.target)).filter((addition) =>
        syncs.every((sync) => !sync.target.equals(addition.target))
    );
    if (additions.length === 0) return {};

    let writes: Sync<T>[] = [];
    let update: OperationRunOutput<V, T>["update"];

    const conflicts: Parameters<ConflictingRemoteBehaviour<V, T>>[2] = [];
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
