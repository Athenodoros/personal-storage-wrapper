import { PSMConfig, SyncFromTargets, SyncOperationLogger, Targets, Value, ValueUpdateOrigin } from "../types";

export interface OperationRunConfig<V extends Value, T extends Targets, S = null> {
    args: S[];
    logger: () => SyncOperationLogger<SyncFromTargets<T>>;
    value: V;
    recents: V[];
    config: PSMConfig<V, T>;
    syncs: SyncFromTargets<T>[];
}

export interface OperationRunOutput<V extends Value, T extends Targets> {
    update?: {
        value: V;
        origin: ValueUpdateOrigin;
    };
    writes?: SyncFromTargets<T>[];
    syncs?: SyncFromTargets<T>[];
    skipChannel?: boolean;
}

export type OperationRunner<S> = <V extends Value = Value, T extends Targets = Targets>(
    config: OperationRunConfig<V, T, S>
) => Promise<OperationRunOutput<V, T>>;
