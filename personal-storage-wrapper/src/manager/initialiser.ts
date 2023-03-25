import { Result } from "../targets/result";
import { noop } from "../utilities/data";
import { ListBuffer } from "../utilities/listbuffer";
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
import { getSyncsFromConfig } from "./serialisation";
import {
    ConflictingSyncStartupBehaviour,
    Deserialisers,
    InitialValue,
    MaybeValue,
    OfflineSyncStartupHandler,
    PSMCreationConfig,
    SyncFromTargets,
    SyncOperationLogger,
    Targets,
    Value,
} from "./types";
import { readFromSync } from "./utilities";

export interface PSMFinalValue<V extends Value, T extends Targets> {
    type: "final";
    syncs: SyncFromTargets<T>[];
    value: V;
}

export interface PSMProvisionalValue<V extends Value, T extends Targets> {
    type: "provisional";
    syncs: { sync: SyncFromTargets<T>; value: Result<MaybeValue<V>> }[];
    value: V;
    resolveConflictingSyncValuesOnStartup: ConflictingSyncStartupBehaviour<T, V>;
}

export type StartValue<V extends Value, T extends Targets> = PSMFinalValue<V, T> | PSMProvisionalValue<V, T>;

// Only exported for testing
export const getPSMStartValue = <V extends Value, T extends Targets>(
    syncs: SyncFromTargets<T>[],
    initialValue: InitialValue<V>,
    handleFullyOfflineSyncsOnStartup: OfflineSyncStartupHandler<T, V>,
    resolveConflictingSyncValuesOnStartup: ConflictingSyncStartupBehaviour<T, V>,
    logger: () => SyncOperationLogger<SyncFromTargets<T>>
) =>
    new Promise<StartValue<V, T>>(async (resolve) => {
        // Pull values from all syncs
        const values = syncs.map((sync) => ({ sync, value: readFromSync<V, T>(logger)(sync) }));

        let resolved = false;

        // Ideally return from first returned value
        values.forEach(async ({ value }) => {
            const result = await value;
            if (result.type === "value" && result.value !== null && !resolved) {
                resolved = true;
                resolve({
                    type: "provisional",
                    value: result.value.value,
                    syncs: values,
                    resolveConflictingSyncValuesOnStartup,
                });
            }
        });

        // Otherwise, fallback to error handlers or defaults
        const results = await Promise.all(
            values.map(({ sync, value: result }) => result.then((value) => ({ sync, value })))
        );

        if (results.some(({ value }) => value.type === "error")) {
            const behaviour = await handleFullyOfflineSyncsOnStartup(results);
            if (behaviour.behaviour === "VALUE" && !resolved) {
                resolved = true;
                resolve({ type: "final", value: behaviour.value, syncs });
                return;
            }
        }

        if (!resolved) {
            resolved = true;
            const value = typeof initialValue !== "function" ? initialValue : await Promise.resolve(initialValue());
            resolve({ type: "final", value, syncs });
        }
    });

export function createPSM<V extends Value>(
    initialValue: InitialValue<V>,
    config?: Partial<PSMCreationConfig<V, DefaultTargetsType>>
): Promise<PersonalStorageManager<V, DefaultTargetsType>>;

export function createPSM<V extends Value, T extends Targets>(
    initialValue: InitialValue<V>,
    config: Partial<PSMCreationConfig<V, T>>,
    deserialisers: Deserialisers<T>
): Promise<PersonalStorageManager<V, T>>;

export async function createPSM<V extends Value, T extends Targets>(
    initialValue: InitialValue<V>,
    initialisationConfig: Partial<PSMCreationConfig<V, T>> = {},
    maybeDeserialisers?: Deserialisers<T>
): Promise<PersonalStorageManager<V, T>> {
    /**
     * Parse defaults
     */
    const deserialisers = maybeDeserialisers ?? (DefaultDeserialisers as Deserialisers<T>);
    const {
        // Updates
        pollPeriodInSeconds = 10,
        onValueUpdate = noop,
        handleSyncOperationLog = noop,

        // Syncs Config
        defaultSyncStates = (maybeDeserialisers ? Promise.resolve([]) : getDefaultSyncStates()) as Promise<
            SyncFromTargets<T>[]
        >,
        getSyncData = getSyncDataFromLocalStorage,
        saveSyncData = saveSyncDataToLocalStorage,
        onSyncStatesUpdate = noop,

        // Value Cache
        valueCacheMillis = 3000,
        valueCacheCount = undefined,

        // Conflict Handlers
        handleFullyOfflineSyncsOnStartup = resetToDefaultsOnOfflineTargets,
        resolveConflictingSyncValuesOnStartup = resolveStartupConflictsWithRemoteStateAndLatestEdit,
        resolveConflictingSyncUpdate = resolveUpdateConflictsWithRemoteStateAndLatestEdit,
    } = initialisationConfig;

    /**
     * Get initialisation values
     */
    const syncsConfig = getSyncData();
    const syncs = syncsConfig ? await getSyncsFromConfig<T>(syncsConfig, deserialisers) : await defaultSyncStates;
    const buffer = new ListBuffer<V>([], { maxLength: valueCacheCount, maxMillis: valueCacheMillis });
    const config = {
        pollPeriodInSeconds,
        onValueUpdate,
        handleSyncOperationLog,
        getSyncData,
        saveSyncData,
        onSyncStatesUpdate,
        resolveConflictingSyncUpdate,
    };

    // Get initial values, including updating logger after PSM creation, and return manager
    let getHandleSyncOperationLog = () => handleSyncOperationLog;
    const start = await getPSMStartValue<V, T>(
        syncs,
        initialValue,
        handleFullyOfflineSyncsOnStartup,
        resolveConflictingSyncValuesOnStartup,
        () => getHandleSyncOperationLog()
    );

    const manager = new PersonalStorageManager<V, T>(start, deserialisers, buffer, config);
    getHandleSyncOperationLog = () => manager.config.handleSyncOperationLog;
    return manager;
}
