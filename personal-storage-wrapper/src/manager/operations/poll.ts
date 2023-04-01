import { deepEquals, deepEqualsList } from "../../utilities/data";
import { ConflictingRemoteBehaviour, SyncFromTargets, Targets, Value } from "../types";
import { readFromSync, timestampFromSync } from "../utilities/requests";
import { OperationRunConfig, OperationRunOutput } from "./types";

export const PollOperationRunner = async <V extends Value, T extends Targets>({
    syncs,
    logger,
    value,
    recents,
    config,
}: OperationRunConfig<V, T>): Promise<OperationRunOutput<V, T>> => {
    let writes: SyncFromTargets<T>[] = [];
    let update: OperationRunOutput<V, T>["update"];

    const conflicts: Parameters<ConflictingRemoteBehaviour<T, V>>[2] = [];
    await Promise.all(
        syncs.map(async (sync) => {
            const timestamp = await timestampFromSync(logger, sync);
            if (timestamp.type === "error" || timestamp.value === sync.lastSeenWriteTime) return;

            if (timestamp.value === null) {
                writes.push(sync);
                return;
            }

            const result = await readFromSync<V, T>(logger, sync);
            if (result.type === "error" || deepEquals(result.value?.value, value)) return;

            if (result.value === null || recents.some((value) => deepEquals(value, result.value?.value))) {
                writes.push(sync);
            } else {
                conflicts.push({ sync, value: result.value });
            }
        })
    );

    if (deepEqualsList(conflicts.map(({ value }) => value.value)) && conflicts.some(({ sync }) => !sync.desynced)) {
        update = { value: conflicts[0].value.value, origin: "REMOTE" };
    } else if (conflicts.length) {
        const newValue = await config.resolveConflictingSyncsUpdate(value, syncs, conflicts);

        if (!deepEquals(newValue, value)) {
            update = { value: newValue, origin: "CONFLICT" };
        } else
            await Promise.all(
                conflicts.map(async (conflict) => {
                    if (!deepEquals(conflict.value.value, newValue)) {
                        writes.push(conflict.sync);
                    }
                })
            );
    }

    return { writes, update };
};
