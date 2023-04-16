import { Target } from "../../targets";
import { last } from "../../utilities/data";
import { Sync, Value } from "../types";
import { OperationRunConfig, OperationRunOutput } from "./types";

export const WriteOperationRunner = async <V extends Value, T extends Target<any, any>>({
    args,
    syncs,
}: OperationRunConfig<V, T, Sync<T>[] | null>): Promise<OperationRunOutput<V, T>> => ({
    writes: (last(args) ?? syncs).filter((sync) => syncs.includes(sync) && sync.desynced !== true),
});
