import { Result } from "../../targets/result";
import { Deserialiser } from "../../targets/types";
import { SyncOperationLog } from "./logs";
import { Sync } from "./syncs";
import { Targets, Value } from "./values";

export interface PSMConfig<V extends Value, T extends Targets> {
    // Updates
    pollPeriodInSeconds: number | null;
    onValueUpdate: (value: V) => void;
    handleSyncOperationLog: (log: SyncOperationLog<SyncType<T>>) => void;

    // Syncs Config
    defaultSyncStates: Promise<SyncType<T>[]>;
    getSyncData: () => string | null;
    saveSyncData: (data: string) => void;
    onSyncStatesUpdate: (sync: SyncType<T>[]) => void;

    // Value Cache
    valueCacheMillis: number | null;
    valueCacheCount: number | null;

    // Conflict Handlers
    handleFullyOfflineSyncsOnStartup: OfflineSyncStartupHandler<T, V>;
    resolveConflictingSyncValuesOnStartup: ConflictingSyncStartupBehaviour<T, V>;
    resolveConflictingSyncUpdate: ConflictingSyncBehaviour<T, V>;
}

export type Deserialisers<T extends Targets> = {
    [K in keyof T]: K extends string ? Deserialiser<K, T> : never;
};

export type SyncType<T extends Targets> = {
    [K in keyof T]: K extends string ? Sync<K, T[K]> : never;
}[keyof T];

export type SyncTypeWithValue<T extends Targets, V extends Value> = {
    sync: SyncType<T>;
    value: Awaited<Result<{ timestamp: Date; value: V } | null>>;
};

export type OfflineSyncStartupBehaviour<V extends Value> = { behaviour: "DEFAULT" } | { behaviour: "VALUE"; value: V };
export type OfflineSyncStartupHandler<T extends Targets, V extends Value> = (
    syncs: SyncTypeWithValue<T, V>
) => Promise<OfflineSyncStartupBehaviour<V>>;

export type ConflictingSyncStartupBehaviour<T extends Targets, V extends Value> = (
    syncs: SyncTypeWithValue<T, V>[]
) => Promise<V>;

export type ConflictingSyncBehaviour<T extends Targets, V extends Value> = (
    localState: V,
    conflicts: SyncTypeWithValue<T, V>
) => Promise<V>;
