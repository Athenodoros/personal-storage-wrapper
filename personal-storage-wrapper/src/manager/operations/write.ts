import { Target } from "../../targets";
import { BehindCause, Sync, Value } from "../types";
import { getBehindCause, hasMovedOn, markBehind, timestampFromSync } from "../utilities/requests";
import { OperationRunConfig, OperationRunOutput } from "./types";

/**
 * What one write asks for: every sync, or only those listed. "ALL" is resolved when the write runs,
 * not when it is asked for, so that it covers syncs added in between. A list is matched by identity,
 * and an empty one asks for nothing.
 */
export type WriteRequest<T extends Target<any, any>> = "ALL" | Sync<T>[];

/**
 * Every sync is checked before it is written to, since something else - another context, or another
 * device - may have written to it since this manager last did. Polling may be off, or not due yet,
 * and a write that went ahead regardless would replace that value without anything having seen it.
 * One that nobody else has written to takes the value straight away. One that has moved on is left
 * for a poll to reconcile, which is asked for here rather than left to the poll timer, and one that
 * can't be reached is left until the next write. Either way it has missed this value, which is
 * recorded so that the poll, and any later startup, knows there is a change here it doesn't have.
 * Targets holding a value that couldn't be read are never written to, which `writeToAndUpdateSync`
 * enforces for every kind of write, so they aren't checked.
 */
export const WriteOperationRunner = async <V extends Value, T extends Target<any, any>>({
    args,
    syncs,
    logger,
}: OperationRunConfig<V, T, WriteRequest<T>>): Promise<OperationRunOutput<V, T>> => {
    // Writes queued together are run as one, so it covers every sync any of them asked for: a new value
    // goes to all of them, and must not be narrowed to the few that another request named
    const targets = syncs.filter((sync) => args.some((arg) => arg === "ALL" || arg.includes(sync)));

    const decisions = await Promise.all(
        targets.map(async (sync): Promise<{ type: "WRITE" } | { type: "SKIP"; cause: BehindCause }> => {
            if (sync.status.type === "UNREADABLE") return { type: "WRITE" };

            const timestamp = await timestampFromSync(logger, sync);
            if (timestamp.type === "error") return { type: "SKIP", cause: getBehindCause(timestamp.error) };

            return hasMovedOn(sync, timestamp.value) ? { type: "SKIP", cause: "MOVED_ON" } : { type: "WRITE" };
        })
    );

    targets.forEach((sync, index) => {
        const decision = decisions[index];
        if (decision.type === "SKIP") markBehind(sync, decision.cause);
    });

    const writes = targets.filter((_, index) => decisions[index].type === "WRITE");
    const poll = decisions.some((decision) => decision.type === "SKIP" && decision.cause === "MOVED_ON");
    return poll ? { writes, poll: true } : { writes };
};
