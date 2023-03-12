import { noop } from "../utilities/data";
import {
    DefaultDeserialisers,
    DefaultTargetsType,
    getDefaultSyncStates,
    getSyncDataFromLocalStorage,
    resetToDefaultsOnOfflineTargets,
    resolveStartupConflictsWithRemoteStateAndLatestEdit,
    resolveUpdateConflictsWithRemoteStateAndLatestEdit,
    saveSyncDataToLocalStorage,
} from "./defaults";
import { PersonalStorageManager } from "./manager";
import { Deserialisers, InitialValue, PSMConfig, SyncType, Targets, Value } from "./types";

export function createPSM<V extends Value>(
    initialValue: InitialValue<V>,
    config?: Partial<PSMConfig<V, DefaultTargetsType>>
): PersonalStorageManager<V, DefaultTargetsType>;

export function createPSM<V extends Value, T extends Targets>(
    initialValue: InitialValue<V>,
    config: Partial<PSMConfig<V, T>>,
    deserialisers: Deserialisers<T>
): PersonalStorageManager<V, T>;

export function createPSM<V extends Value, T extends Targets>(
    initialValue: InitialValue<V>,
    config: Partial<PSMConfig<V, T>> = {},
    deserialisers?: Deserialisers<T>
): PersonalStorageManager<V, T> {
    const {
        // Updates
        pollPeriodInSeconds = 10,
        onValueUpdate = noop,
        handleSyncOperationLog = noop,

        // Syncs Config
        defaultSyncStates = (deserialisers ? [] : getDefaultSyncStates()) as unknown as Promise<SyncType<T>[]>,
        getSyncData = getSyncDataFromLocalStorage,
        saveSyncData = saveSyncDataToLocalStorage,
        onSyncStatesUpdate = noop,

        // Value Cache
        valueCacheMillis = 3000,
        valueCacheCount = null,

        // Conflict Handlers
        handleFullyOfflineSyncsOnStartup = resetToDefaultsOnOfflineTargets,
        resolveConflictingSyncValuesOnStartup = resolveStartupConflictsWithRemoteStateAndLatestEdit,
        resolveConflictingSyncUpdate = resolveUpdateConflictsWithRemoteStateAndLatestEdit,
    } = config;

    return new PersonalStorageManager<V, T>(
        initialValue,
        {
            // Updates
            pollPeriodInSeconds,
            onValueUpdate,
            handleSyncOperationLog,

            // Syncs Config
            defaultSyncStates,
            getSyncData,
            saveSyncData,
            onSyncStatesUpdate,

            // Value Cache
            valueCacheMillis,
            valueCacheCount,

            // Conflict Handlers
            handleFullyOfflineSyncsOnStartup,
            resolveConflictingSyncValuesOnStartup,
            resolveConflictingSyncUpdate,
        },
        deserialisers ?? (DefaultDeserialisers as Deserialisers<T>)
    );
}
