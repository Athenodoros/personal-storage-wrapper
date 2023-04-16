import { Target } from "../../targets";
import { Sync, Value } from "../types";
import { OperationRunConfig, OperationRunOutput } from "./types";

export const RemovalOperationRunner = async <V extends Value, T extends Target<any, any>>({
    args,
    syncs,
}: OperationRunConfig<V, T, Sync<T>>): Promise<OperationRunOutput<V, T>> => ({
    syncs: syncs.filter((sync) => args.every((removal) => !removal.target.equals(sync.target))),
});
