import { Target } from "../../targets";
import { deepEquals, uniqEquals } from "../../utilities/data";
import { ConflictingRemoteBehaviour, Sync, Value } from "../types";
import { markInStep, markReplacing, readFromSync } from "../utilities/requests";
import { OperationRunConfig, OperationRunOutput } from "./types";

/**
 * A sync to add, and the value the application has decided to write over if the target still holds it:
 * one it read there itself, before deciding to sync to the target at all
 */
export interface Addition<V extends Value, T extends Target<any, any>> {
    sync: Sync<T>;
    replacing?: V;
}

export const AdditionOperationRunner = async <V extends Value, T extends Target<any, any>>({
    args,
    syncs,
    logger,
    value,
    config,
}: OperationRunConfig<V, T, Addition<V, T>>): Promise<OperationRunOutput<V, T>> => {
    const requests = uniqEquals(args, (a1, a2) => a1.sync.target.equals(a2.sync.target)).filter(({ sync: addition }) =>
        syncs.every((sync) => !sync.target.equals(addition.target))
    );
    if (requests.length === 0) return {};
    const additions = requests.map(({ sync }) => sync);

    let writes: Sync<T>[] = [];
    let update: OperationRunOutput<V, T>["update"];

    const conflicts: Parameters<ConflictingRemoteBehaviour<V, T>>[2] = [];
    await Promise.all(
        requests.map(({ sync, replacing }) =>
            readFromSync<V, T>(logger, sync, config).then(async (result) => {
                if (result.type === "error") {
                    sync.missedWrite = true;
                } else if (result.value === null) {
                    writes.push(sync);
                } else if (deepEquals(result.value.value, value)) {
                    markInStep(sync, result.value.timestamp);
                } else if (replacing !== undefined && deepEquals(result.value.value, replacing)) {
                    markReplacing(sync, result.value.timestamp);
                    writes.push(sync);
                } else {
                    conflicts.push({ sync, value: result.value });
                }
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
            if (!deepEquals(conflict.value.value, newValue)) writes.push(conflict.sync);
            else markInStep(conflict.sync, conflict.value.timestamp);
        });
    }

    return {
        syncs: syncs.concat(additions),
        update,
        writes,
    };
};
