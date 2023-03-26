import { ResultValueType } from "../../targets/result";
import { Deserialiser } from "../../targets/types";
import { SyncOperationLogger } from "./logs";
import { Sync } from "./syncs";
import { Targets, TimestampedValue, Value } from "./values";

export interface PSMConfig<V extends Value, T extends Targets> {
    // Updates
    pollPeriodInSeconds: number | null;
    onValueUpdate: (value: V, origin: "REMOTE" | "BROADCAST" | "LOCAL" | "CONFLICT") => void;
    handleSyncOperationLog: SyncOperationLogger<SyncFromTargets<T>>;

    // Syncs Config
    getSyncData: () => string | null;
    saveSyncData: (data: string) => void;
    onSyncStatesUpdate: (sync: SyncFromTargets<T>[]) => void;

    // Conflict Handlers
    resolveConflictingSyncsUpdate: ConflictingRemoteBehaviour<T, V>;
}

export interface PSMCreationConfig<V extends Value, T extends Targets> extends PSMConfig<V, T> {
    id: string;

    // Syncs Config
    defaultSyncStates: Promise<SyncFromTargets<T>[]>;

    // Value Cache
    valueCacheMillis: number | undefined;
    valueCacheCount: number | undefined;

    // Conflict Handlers
    handleAllEmptyAndFailedSyncsOnStartup: OfflineSyncStartupHandler<T, V>;
    resolveConflictingSyncValuesOnStartup: ConflictingSyncStartupBehaviour<T, V>;
}

export type Deserialisers<T extends Targets> = {
    [K in keyof T]: K extends string ? Deserialiser<K, T[K]> : never;
};

export type SyncFromTargets<T extends Targets> = {
    [K in keyof T]: K extends string ? Sync<K, T[K]> : never;
}[keyof T];

export type OfflineSyncStartupBehaviour<V extends Value> = { behaviour: "DEFAULT" } | { behaviour: "VALUE"; value: V };
export type OfflineSyncStartupHandler<T extends Targets, V extends Value> = (
    syncs: {
        sync: SyncFromTargets<T>;
        value: ResultValueType<null>;
    }[]
) => Promise<OfflineSyncStartupBehaviour<V>>;

export type ConflictingSyncStartupBehaviour<T extends Targets, V extends Value> = (
    syncs: {
        sync: SyncFromTargets<T>;
        value: TimestampedValue<V>;
    }[]
) => Promise<V>;

export type ConflictingRemoteBehaviour<T extends Targets, V extends Value> = (
    localState: V,
    syncs: SyncFromTargets<T>[],
    conflicts: {
        sync: SyncFromTargets<T>;
        value: TimestampedValue<V>;
    }[]
) => Promise<V>;
