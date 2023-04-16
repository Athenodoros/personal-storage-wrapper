import { ResultValueType } from "../../targets/result";
import { Deserialiser, Target } from "../../targets/types";
import { DefaultTarget } from "../utilities/defaults";
import { SyncOperationLogger } from "./logs";
import { Sync } from "./syncs";
import { TimestampedValue, Value } from "./values";

export type ValueUpdateOrigin = "REMOTE" | "BROADCAST" | "LOCAL" | "CONFLICT" | "CREATION";

export interface PSMConfig<V extends Value, T extends Target<any, any> = DefaultTarget> {
    // Updates
    pollPeriodInSeconds: number | null;
    onValueUpdate: (value: V, origin: ValueUpdateOrigin) => void;
    handleSyncOperationLog: SyncOperationLogger<Sync<T>>;

    // Syncs Config
    saveSyncData: (data: string) => void;
    onSyncStatesUpdate: (sync: Sync<T>[]) => void;

    // Conflict Handlers
    resolveConflictingSyncsUpdate: ConflictingRemoteBehaviour<V, T>;
}

export interface PSMCreationConfig<V extends Value, T extends Target<any, any> = DefaultTarget>
    extends PSMConfig<V, T> {
    id: string;
    ignoreDuplicateCheck: boolean;

    // Syncs Config
    getSyncData: () => string | null;
    getDefaultSyncs: () => Promise<Sync<T>[]>;

    // Value Cache
    valueCacheMillis: number | undefined;
    valueCacheCount: number | undefined;

    // Conflict Handlers
    handleAllEmptyAndFailedSyncsOnStartup: OfflineSyncStartupHandler<V, T>;
    resolveConflictingSyncValuesOnStartup: ConflictingSyncStartupBehaviour<V, T>;
}

export type Deserialisers<T extends Target<any, any> = DefaultTarget> = {
    [K in T["type"]]: T extends Target<K, any> ? Deserialiser<T> : never;
};

export type OfflineSyncStartupBehaviour<V extends Value> = { behaviour: "DEFAULT" } | { behaviour: "VALUE"; value: V };
export type OfflineSyncStartupHandler<V extends Value, T extends Target<any, any> = DefaultTarget> = (
    syncs: {
        sync: Sync<T>;
        value: ResultValueType<V>;
    }[]
) => Promise<OfflineSyncStartupBehaviour<V>>;

export type ConflictingSyncStartupBehaviour<V extends Value, T extends Target<any, any> = DefaultTarget> = (
    originalValue: V,
    currentValue: V,
    syncs: {
        sync: Sync<T>;
        value: TimestampedValue<V>;
    }[]
) => Promise<V>;

export type ConflictingRemoteBehaviour<V extends Value, T extends Target<any, any> = DefaultTarget> = (
    localState: V,
    syncs: Sync<T>[],
    conflicts: {
        sync: Sync<T>;
        value: TimestampedValue<V>;
    }[]
) => Promise<V>;
