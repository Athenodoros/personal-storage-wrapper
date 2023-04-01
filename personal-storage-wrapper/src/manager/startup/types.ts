import { Result } from "../../targets/result";
import { ConflictingSyncStartupBehaviour, MaybeValue, SyncFromTargets, Targets, Value } from "../types";

export interface PSMFinalValue<V extends Value, T extends Targets> {
    type: "final";
    syncs: SyncFromTargets<T>[];
    value: V;
}

export interface PSMProvisionalValue<V extends Value, T extends Targets> {
    type: "provisional";
    syncs: { sync: SyncFromTargets<T>; value: Result<MaybeValue<V>> }[];
    value: V;
    resolve: ConflictingSyncStartupBehaviour<T, V>;
}

export type StartValue<V extends Value, T extends Targets> = PSMFinalValue<V, T> | PSMProvisionalValue<V, T>;
