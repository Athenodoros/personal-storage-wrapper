import { last } from "../../utilities/data";
import { SyncFromTargets, Targets, Value } from "../types";
import { OperationRunConfig, OperationRunOutput } from "./types";

export const WriteOperationRunner = async <V extends Value, T extends Targets>({
    args,
    syncs,
}: OperationRunConfig<V, T, SyncFromTargets<T>[] | null>): Promise<OperationRunOutput<V, T>> => ({
    writes: (last(args) ?? syncs).filter((sync) => syncs.includes(sync) && sync.desynced !== true),
});
