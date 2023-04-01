import { Targets, Value } from "../types";
import { OperationRunConfig, OperationRunOutput } from "./types";

export const WriteOperationRunner = async <V extends Value, T extends Targets>({
    syncs,
}: OperationRunConfig<V, T>): Promise<OperationRunOutput<V, T>> => ({
    writes: syncs.filter((sync) => sync.desynced !== true),
});
