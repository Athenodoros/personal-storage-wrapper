import { Target } from "../../targets";
import { Sync, Value } from "../types";
import { hasMovedOn, timestampFromSync } from "../utilities/requests";
import { OperationRunConfig, OperationRunOutput } from "./types";

/**
 * What one write asks for: every sync, or only those listed. "ALL" is resolved when the write runs,
 * not when it is asked for, so that it covers syncs added in between. A list is matched by identity,
 * and an empty one asks for nothing.
 */
export type WriteRequest<T extends Target<any, any>> = "ALL" | Sync<T>[];

/**
 * A sync that missed a write - in this session or an earlier one - may have been written to by
 * something else since: another context, or another device. It is checked before being written again,
 * whatever kind of target it is: one that nobody else has written to takes the value straight away,
 * and one that has moved on is left for a poll to reconcile, which is asked for here rather than left
 * to the poll timer, since polling may be off. Targets holding a value that couldn't be read are never
 * written to, which `writeToAndUpdateSync` enforces for every kind of write, so they aren't checked.
 */
export const WriteOperationRunner = async <V extends Value, T extends Target<any, any>>({
    args,
    syncs,
    logger,
}: OperationRunConfig<V, T, WriteRequest<T>>): Promise<OperationRunOutput<V, T>> => {
    // Writes queued together are run as one, so it covers every sync any of them asked for: a new value
    // goes to all of them, and must not be narrowed to the few that another request named
    const targets = syncs.filter((sync) => args.some((arg) => arg === "ALL" || arg.includes(sync)));
    const needsCheck = (sync: Sync<T>) => sync.missedWrite === true && !sync.unreadable;
    if (!targets.some(needsCheck)) return { writes: targets };

    const decisions = await Promise.all(
        targets.map(async (sync): Promise<"WRITE" | "POLL" | "SKIP"> => {
            if (!needsCheck(sync)) return "WRITE";

            const timestamp = await timestampFromSync(logger, sync);
            if (timestamp.type === "error") return "SKIP";

            return hasMovedOn(sync, timestamp.value) ? "POLL" : "WRITE";
        })
    );

    const writes = targets.filter((_, index) => decisions[index] === "WRITE");
    return decisions.includes("POLL") ? { writes, poll: true } : { writes };
};
