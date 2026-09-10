export type {
    // Basic Types
    Sync,
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

// Reading a target without syncing to it, for deciding whether to sync to it at all
export { readValueFromTarget } from "./utilities/requests";
