import { Target } from "../../targets";
import { deepEquals, deepEqualsList } from "../../utilities/data";
import { ConflictingRemoteBehaviour, Sync, Value } from "../types";
import { hasMovedOn, markInStep, readFromSync, timestampFromSync } from "../utilities/requests";
import { OperationRunConfig, OperationRunOutput } from "./types";

export const PollOperationRunner = async <V extends Value, T extends Target<any, any>>({
    syncs,
    logger,
    value,
    recents,
    config,
}: OperationRunConfig<V, T>): Promise<OperationRunOutput<V, T>> => {
    let writes: Sync<T>[] = [];
    let update: OperationRunOutput<V, T>["update"];

    const conflicts: Parameters<ConflictingRemoteBehaviour<V, T>>[2] = [];
    const failures: Sync<T>[] = [];
    await Promise.all(
        syncs.map(async (sync) => {
            const timestamp = await timestampFromSync(logger, sync);
            if (timestamp.type === "error") {
                failures.push(sync);
                return;
            }
            // An empty target has nothing in it to lose, whatever it held before
            if (timestamp.value === null) {
                sync.unreadable = false;
                writes.push(sync);
                return;
            }

            // Nothing else has written to it, so it holds the last value written here - unless that
            // write failed, in which case it is sent again
            if (!hasMovedOn(sync, timestamp.value)) {
                if (sync.missedWrite) writes.push(sync);
                return;
            }

            const result = await readFromSync<V, T>(logger, sync, config);
            if (result.type === "error") return;
            if (result.value !== null && deepEquals(result.value.value, value))
                return markInStep(sync, result.value.timestamp);

            if (result.value === null || recents.some((value) => deepEquals(value, result.value?.value))) {
                writes.push(sync);
            } else {
                conflicts.push({ sync, value: result.value });
            }
        })
    );

    if (deepEqualsList(conflicts.map(({ value }) => value.value)) && conflicts.some(({ sync }) => !sync.missedWrite)) {
        update = { value: conflicts[0].value.value, origin: "REMOTE" };
        conflicts.forEach(({ sync, value }) => markInStep(sync, value.timestamp));
        writes = syncs.filter(
            (sync) =>
                !conflicts.some((conflict) => conflict.sync.target.equals(sync.target)) && !failures.includes(sync)
        );
    } else if (conflicts.length) {
        const newValue = await config.resolveConflictingSyncsUpdate(value, syncs, conflicts);

        if (!deepEquals(newValue, value)) {
            update = { value: newValue, origin: "CONFLICT" };
        }

        syncs.forEach((sync) => {
            if (failures.includes(sync)) return;

            const conflict = conflicts.find((conflict) => conflict.sync.target.equals(sync.target));
            if (conflict === undefined || !deepEquals(conflict.value.value, newValue)) writes.push(sync);
            else markInStep(sync, conflict.value.timestamp);
        });
    }

    return { writes, update };
};
