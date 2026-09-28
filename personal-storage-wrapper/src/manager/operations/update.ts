import { Target } from "../../targets";
import { last } from "../../utilities/data";
import { Sync, Value } from "../types";
import { OperationRunConfig, OperationRunOutput } from "./types";

/**
 * Takes on the syncs another context has sent. Whether a target holds a value this context can't use
 * is this context's own finding - another may validate differently - so it is carried over rather
 * than lost with the objects being replaced.
 */
export const UpdateOperationRunner = async <V extends Value, T extends Target<any, any>>({
    args,
    syncs,
}: OperationRunConfig<V, T, Sync<T>[]>): Promise<OperationRunOutput<V, T>> => ({
    syncs: last(args)?.map((update) =>
        syncs.some((sync) => sync.unreadable && sync.target.equals(update.target))
            ? { ...update, unreadable: true }
            : update
    ),
    skipChannel: true,
});
