export type {
    // Basic Types
    Sync,
    NewSync,
    SyncStatus,
    BehindCause,
    Value,
    TimestampedValue,
    MaybeValue,

    // Creation
    InitialValue,
    Deserialisers,

    // Logging
    SyncOperationLogger,
    SyncOperationLog,
    SyncOperation,
    SyncLogStage,
    ValueUpdateOrigin,

    // Config
    PSMConfig,
    PSMCreationConfig,
    OfflineSyncStartupBehaviour,
    OfflineSyncStartupHandler,
    ConflictingSyncStartupBehaviour,
    ConflictingRemoteBehaviour,
    UnreadableValueSource,
    SaveResult,
    StartSource,
    SyncsSource,
} from "./types";

export type { DefaultTarget } from "./utilities/defaults";
export {
    // Deserialisers
    DefaultDeserialisers,

    // Default Sync Management
    getSyncDataFromLocalStorage,
    saveSyncDataToLocalStorage,
    getDefaultSyncStates,

    // Default Conflict Handlers
    resetToDefaultsOnOfflineTargets,
    resolveStartupConflictsWithRemoteStateAndLatestEdit,
    resolveUpdateConflictsWithRemoteStateAndLatestEdit,
} from "./utilities/defaults";

export { PersonalStorageManager } from "./manager";
export { toSync } from "./types";
export type { AdditionOptions } from "./manager";
export type { CreatedPSM } from "./manager";

// Reading a target without syncing to it, for deciding whether to sync to it at all
export { readValueFromTarget } from "./utilities/requests";
