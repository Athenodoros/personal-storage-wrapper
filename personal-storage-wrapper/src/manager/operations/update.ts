import { Target } from "../../targets";
import { last } from "../../utilities/data";
import { Sync, Value } from "../types";
import { OperationRunConfig, OperationRunOutput } from "./types";

export const UpdateOperationRunner = async <V extends Value, T extends Target<any, any>>({
    args,
}: OperationRunConfig<V, T, Sync<T>[]>): Promise<OperationRunOutput<V, T>> => ({
    syncs: last(args),
    skipChannel: true,
});
