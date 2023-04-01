import { SyncFromTargets, Targets, Value } from "../types";
import { OperationRunConfig, OperationRunOutput } from "./types";

export const RemovalOperationRunner = async <V extends Value, T extends Targets>({
    args,
    syncs,
}: OperationRunConfig<V, T, SyncFromTargets<Targets>>): Promise<OperationRunOutput<V, T>> => ({
    syncs: syncs.filter((sync) => args.every((removal) => removal.target !== sync.target)),
});
