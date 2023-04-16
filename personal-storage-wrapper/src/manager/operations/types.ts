import { Target } from "../../targets";
import { PSMConfig, Sync, SyncOperationLogger, Value, ValueUpdateOrigin } from "../types";

export interface OperationRunConfig<V extends Value, T extends Target<any, any>, S = null> {
    args: S[];
    logger: () => SyncOperationLogger<Sync<T>>;
    value: V;
    recents: V[];
    config: PSMConfig<V, T>;
    syncs: Sync<T>[];
}

export interface OperationRunOutput<V extends Value, T extends Target<any, any>> {
    update?: {
        value: V;
        origin: ValueUpdateOrigin;
    };
    writes?: Sync<T>[];
    syncs?: Sync<T>[];
    skipChannel?: boolean;
}

export type OperationRunner<S> = <V extends Value = Value, T extends Target<any, any> = Target<any, any>>(
    config: OperationRunConfig<V, T, S>
) => Promise<OperationRunOutput<V, T>>;
