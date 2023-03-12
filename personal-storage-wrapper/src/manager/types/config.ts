import { Result } from "../../targets/result";
import { Deserialiser } from "../../targets/types";
import { SyncOperationLog } from "./logs";
import { Sync } from "./syncs";
import { MaybeValue, Targets, Value } from "./values";

export interface PSMConfig<V extends Value, T extends Targets> {
    // Updates
    pollPeriodInSeconds: number | null;
    onValueUpdate: (value: V) => void;
    handleSyncOperationLog: (log: SyncOperationLog<SyncFromTargets<T>>) => void;

    // Syncs Config
    getSyncData: () => string | null;
    saveSyncData: (data: string) => void;
    onSyncStatesUpdate: (sync: SyncFromTargets<T>[]) => void;

    // Conflict Handlers
    resolveConflictingSyncUpdate: ConflictingSyncBehaviour<T, V>;
}

export interface PSMCreationConfig<V extends Value, T extends Targets> extends PSMConfig<V, T> {
    // Syncs Config
    defaultSyncStates: Promise<SyncFromTargets<T>[]>;

    // Value Cache
    valueCacheMillis: number | undefined;
    valueCacheCount: number | undefined;

    // Conflict Handlers
    handleFullyOfflineSyncsOnStartup: OfflineSyncStartupHandler<T, V>;
    resolveConflictingSyncValuesOnStartup: ConflictingSyncStartupBehaviour<T, V>;
}

export type Deserialisers<T extends Targets> = {
    [K in keyof T]: K extends string ? Deserialiser<K, T[K]> : never;
};

export type SyncFromTargets<T extends Targets> = {
    [K in keyof T]: K extends string ? Sync<K, T[K]> : never;
}[keyof T];

export type SyncTypeWithValue<T extends Targets, V extends Value> = {
    sync: SyncFromTargets<T>;
    value: Awaited<Result<MaybeValue<V>>>;
};

export type OfflineSyncStartupBehaviour<V extends Value> = { behaviour: "DEFAULT" } | { behaviour: "VALUE"; value: V };
export type OfflineSyncStartupHandler<T extends Targets, V extends Value> = (
    syncs: SyncTypeWithValue<T, V>[]
) => Promise<OfflineSyncStartupBehaviour<V>>;

export type ConflictingSyncStartupBehaviour<T extends Targets, V extends Value> = (
    syncs: SyncTypeWithValue<T, V>[]
) => Promise<V>;

export type ConflictingSyncBehaviour<T extends Targets, V extends Value> = (
    localState: V,
    conflicts: SyncTypeWithValue<T, V>
) => Promise<V>;
