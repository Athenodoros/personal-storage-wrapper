import { ErrorResult, ResultValueType } from "../../targets/result";
import { Deserialiser, Target } from "../../targets/types";
import { DefaultTarget } from "../utilities/defaults";
import { SyncOperationLogger } from "./logs";
import { NewSync, Sync } from "./syncs";
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

    // Validation
    /**
     * Checked against every value read from a target or sent by another context, before the manager
     * uses it: null if the value can be used, or why it can't. A target whose value fails is treated as
     * holding a corrupt one - it is marked `UNREADABLE` and never written to - and a value from another
     * context that fails is dropped. The value is untrusted, so it is typed as unknown.
     */
    validate: (value: unknown) => string | null;
    /**
     * Called whenever a value is refused, because it could not be decoded or failed `validate`: from a
     * target, including during startup, or from another context. The error carries what there was of
     * the value. A refused value from another context usually means that context runs a different
     * version of the application, which is for the application to decide what to do about.
     */
    onUnreadableValue: (error: ErrorResult, source: UnreadableValueSource<T>) => void;
}

export type UnreadableValueSource<T extends Target<any, any> = DefaultTarget> =
    | { type: "SYNC"; sync: Sync<T> }
    | { type: "BROADCAST" };

export interface PSMCreationConfig<V extends Value, T extends Target<any, any> = DefaultTarget>
    extends PSMConfig<V, T> {
    id: string;
    ignoreDuplicateCheck: boolean;

    // Syncs Config
    getSyncData: () => string | null;
    getDefaultSyncs: () => Promise<NewSync<T>[]>;

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

/**
 * Settles targets that disagree on startup. `originalValue` is the value the manager started with, and
 * `getCurrentValue` gives the value it holds now: the application can go on changing it while this runs,
 * which may be for as long as it waits on the user. The manager takes on exactly the value returned, so
 * a handler that keeps the manager's copy returns `getCurrentValue()` once it has decided, to keep any
 * changes made meanwhile.
 */
export type ConflictingSyncStartupBehaviour<V extends Value, T extends Target<any, any> = DefaultTarget> = (
    originalValue: V,
    getCurrentValue: () => V,
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
