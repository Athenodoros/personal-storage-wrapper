import { last } from "../../utilities/data";
import { SyncFromTargets, Targets, Value } from "../types";
import { OperationRunConfig, OperationRunOutput } from "./types";

export const UpdateOperationRunner = async <V extends Value, T extends Targets>({
    args,
}: OperationRunConfig<V, T, SyncFromTargets<T>[]>): Promise<OperationRunOutput<V, T>> => ({
    syncs: last(args),
    skipChannel: true,
});
