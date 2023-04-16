import { Target } from "../../targets";
import { ResultValueType } from "../../targets/result";
import { noop } from "../../utilities/data";
import { ListBuffer } from "../../utilities/listbuffer";
import { PersonalStorageManager } from "../manager";
import {
    ConflictingSyncStartupBehaviour,
    Deserialisers,
    InitialValue,
    OfflineSyncStartupHandler,
    PSMConfig,
    PSMCreationConfig,
    Sync,
    SyncOperationLogger,
    Value,
} from "../types";
import {
    DefaultDeserialisers,
    getDefaultSyncStates,
    getSyncDataFromLocalStorage,
    resetToDefaultsOnOfflineTargets,
    resolveStartupConflictsWithRemoteStateAndLatestEdit,
    resolveUpdateConflictsWithRemoteStateAndLatestEdit,
    saveSyncDataToLocalStorage,
} from "../utilities/defaults";
import { readFromSync } from "../utilities/requests";
import { getSyncsFromConfig } from "../utilities/serialisation";
import { StartValue } from "./types";

// Only exported for testing
export const getPSMStartValue = <V extends Value, T extends Target<any, any>>(
    syncs: Sync<T>[],
    defaultInitialValue: InitialValue<V>,
    handleAllEmptyAndFailedSyncsOnStartup: OfflineSyncStartupHandler<V, T>,
    resolveConflictingSyncValuesOnStartup: ConflictingSyncStartupBehaviour<V, T>,
    logger: () => SyncOperationLogger<Sync<T>>
) =>
    new Promise<StartValue<V, T>>(async (resolve) => {
        // Pull values from all syncs
        const values = syncs.map((sync) => ({ sync, value: readFromSync<V, T>(logger, sync) }));

        let resolved = false;

        // Ideally return from first returned value
        values.forEach(async ({ value }) => {
            const result = await value;
            if (result.type === "value" && result.value !== null && !resolved) {
                resolved = true;
                resolve({
                    type: "provisional",
                    value: result.value.value,
                    values,
                    resolve: resolveConflictingSyncValuesOnStartup,
                });
            }
        });

        // Otherwise, fallback to error handlers or defaults
        const results = await Promise.all(
            values.map(({ sync, value: result }) => result.then((value) => ({ sync, value })))
        );

        if (results.some(({ value }) => value.type === "error") && results.every(({ value }) => !value.value)) {
            const behaviour = await handleAllEmptyAndFailedSyncsOnStartup(
                results as { sync: Sync<T>; value: ResultValueType<V> }[]
            );
            if (behaviour.behaviour === "VALUE" && !resolved) {
                resolved = true;
                resolve({ type: "final", value: behaviour.value, results });
                return;
            }
        }

        if (results.every(({ value }) => !value.value) && !resolved) {
            resolved = true;
            const value =
                typeof defaultInitialValue !== "function"
                    ? defaultInitialValue
                    : await Promise.resolve(defaultInitialValue());
            resolve({ type: "final", value, results });
        }
    });

const managers = new Set<string>();

export async function createPSM<V extends Value, T extends Target<any, any>>(
    createPSMObject: (
        id: string,
        start: StartValue<V, T>,
        deserialisers: Deserialisers<T>,
        recents: ListBuffer<V>,
        config: PSMConfig<V, T>
    ) => PersonalStorageManager<V, T>,
    defaultInitialValue: InitialValue<V>,
    initialisationConfig: Partial<PSMCreationConfig<V, T>> = {},
    getLatestConfig: () => Partial<PSMCreationConfig<V, T>> = () => ({}),
    maybeDeserialisers?: Deserialisers<T>
): Promise<PersonalStorageManager<V, T>> {
    /**
     * Parse defaults
     */
    const deserialisers = maybeDeserialisers ?? (DefaultDeserialisers as Deserialisers<T>);
    const {
        id = "psm-default-id",
        ignoreDuplicateCheck = false,
        getDefaultSyncs = (maybeDeserialisers ? () => Promise.resolve([]) : getDefaultSyncStates) as () => Promise<
            Sync<T>[]
        >,
        getSyncData = getSyncDataFromLocalStorage,
        handleAllEmptyAndFailedSyncsOnStartup = resetToDefaultsOnOfflineTargets,
        resolveConflictingSyncValuesOnStartup = resolveStartupConflictsWithRemoteStateAndLatestEdit,
    } = initialisationConfig;

    /**
     * Dedupe so that managers don't clobber each other over broadcast channels
     */
    if (managers.has(id) && !ignoreDuplicateCheck)
        throw new Error(
            "Duplicate PSMs found within browser context - this is probably an error, or at least a bad idea. If not, pass `ignoreDuplicateCheck = true`."
        );
    managers.add(id);

    /**
     * Get initialisation values
     */
    const syncsConfig = getSyncData();
    const syncs = syncsConfig ? await getSyncsFromConfig<T>(syncsConfig, deserialisers) : await getDefaultSyncs();

    // Get initial values, including updating logger after PSM creation, and return manager
    let getHandleSyncOperationLog = () => getLatestConfig().handleSyncOperationLog ?? noop;
    const start = await getPSMStartValue<V, T>(
        syncs,
        defaultInitialValue,
        handleAllEmptyAndFailedSyncsOnStartup,
        resolveConflictingSyncValuesOnStartup,
        () => getHandleSyncOperationLog()
    );

    const latestConfig = getLatestConfig();
    const config: PSMConfig<V, T> = {
        pollPeriodInSeconds: latestConfig.pollPeriodInSeconds === undefined ? 10 : latestConfig.pollPeriodInSeconds,
        onValueUpdate: latestConfig.onValueUpdate ?? noop,
        saveSyncData: latestConfig.saveSyncData ?? saveSyncDataToLocalStorage,
        onSyncStatesUpdate: latestConfig.onSyncStatesUpdate ?? noop,
        resolveConflictingSyncsUpdate:
            latestConfig.resolveConflictingSyncsUpdate ?? resolveUpdateConflictsWithRemoteStateAndLatestEdit,
        handleSyncOperationLog: getHandleSyncOperationLog(),
    };
    const buffer = new ListBuffer<V>([], {
        maxLength: latestConfig.valueCacheCount,
        maxMillis: latestConfig.valueCacheMillis ?? 3000,
    });

    const manager = createPSMObject(id, start, deserialisers, buffer, config);
    getHandleSyncOperationLog = () => manager.config.handleSyncOperationLog;
    return manager;
}
