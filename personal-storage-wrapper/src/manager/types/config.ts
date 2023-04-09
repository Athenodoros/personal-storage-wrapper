import { ResultValueType } from "../../targets/result";
import { Deserialiser, Target } from "../../targets/types";
import { DefaultTargetsType } from "../utilities/defaults";
import { SyncOperationLogger } from "./logs";
import { Sync } from "./syncs";
import { Targets, TimestampedValue, Value } from "./values";

export type ValueUpdateOrigin = "REMOTE" | "BROADCAST" | "LOCAL" | "CONFLICT" | "CREATION";

export interface PSMConfig<V extends Value, T extends Targets = DefaultTargetsType> {
    // Updates
    pollPeriodInSeconds: number | null;
    onValueUpdate: (value: V, origin: ValueUpdateOrigin) => void;
    handleSyncOperationLog: SyncOperationLogger<SyncFromTargets<T>>;

    // Syncs Config
    saveSyncData: (data: string) => void;
    onSyncStatesUpdate: (sync: SyncFromTargets<T>[]) => void;

    // Conflict Handlers
    resolveConflictingSyncsUpdate: ConflictingRemoteBehaviour<V, T>;
}

export interface PSMCreationConfig<V extends Value, T extends Targets = DefaultTargetsType> extends PSMConfig<V, T> {
    id: string;
    ignoreDuplicateCheck: boolean;

    // Syncs Config
    getSyncData: () => string | null;
    getDefaultSyncs: () => Promise<SyncFromTargets<T>[]>;

    // Value Cache
    valueCacheMillis: number | undefined;
    valueCacheCount: number | undefined;

    // Conflict Handlers
    handleAllEmptyAndFailedSyncsOnStartup: OfflineSyncStartupHandler<V, T>;
    resolveConflictingSyncValuesOnStartup: ConflictingSyncStartupBehaviour<V, T>;
}

export type Deserialisers<T extends Targets = DefaultTargetsType> = {
    [K in keyof T]: K extends string ? Deserialiser<K, T[K]> : never;
};

export type TargetFromTargets<T extends Targets = DefaultTargetsType> = {
    [K in keyof T]: K extends string ? Target<K, T[K]> : never;
}[keyof T];
export type SyncFromTargets<T extends Targets = DefaultTargetsType> = {
    [K in keyof T]: K extends string ? Sync<K, T[K]> : never;
}[keyof T];

export type OfflineSyncStartupBehaviour<V extends Value> = { behaviour: "DEFAULT" } | { behaviour: "VALUE"; value: V };
export type OfflineSyncStartupHandler<V extends Value, T extends Targets = DefaultTargetsType> = (
    syncs: {
        sync: SyncFromTargets<T>;
        value: ResultValueType<null>;
    }[]
) => Promise<OfflineSyncStartupBehaviour<V>>;

export type ConflictingSyncStartupBehaviour<V extends Value, T extends Targets = DefaultTargetsType> = (
    originalValue: V,
    currentValue: V,
    syncs: {
        sync: SyncFromTargets<T>;
        value: TimestampedValue<V>;
    }[]
) => Promise<V>;

export type ConflictingRemoteBehaviour<V extends Value, T extends Targets = DefaultTargetsType> = (
    localState: V,
    syncs: SyncFromTargets<T>[],
    conflicts: {
        sync: SyncFromTargets<T>;
        value: TimestampedValue<V>;
    }[]
) => Promise<V>;
