import { Target } from "../../targets";
import { last } from "../../utilities/data";
import { Sync, Value } from "../types";
import { OperationRunConfig, OperationRunOutput } from "./types";

/**
 * Takes on the syncs another context has sent, which only say whether each target is behind. Whether a
 * target holds a value this context can't use is this context's own finding - another may validate
 * differently - and so is why a target it also has behind is behind, so both are carried over rather
 * than lost with the objects being replaced.
 */
export const UpdateOperationRunner = async <V extends Value, T extends Target<any, any>>({
    args,
    syncs,
}: OperationRunConfig<V, T, Sync<T>[]>): Promise<OperationRunOutput<V, T>> => ({
    syncs: last(args)?.map((update) => {
        const own = syncs.find((sync) => sync.target.equals(update.target))?.status;
        const keepOwn = own?.type === "UNREADABLE" || (own?.type === "BEHIND" && update.status.type === "BEHIND");
        return keepOwn ? { ...update, status: own } : update;
    }),
    skipChannel: true,
});
