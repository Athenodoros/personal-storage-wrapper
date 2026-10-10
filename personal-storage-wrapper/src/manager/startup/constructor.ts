import { Target } from "../../targets";
import { ResultValueType } from "../../targets/result";
import { noop } from "../../utilities/data";
import { ListBuffer } from "../../utilities/listbuffer";
import type { CreatedPSM, PersonalStorageManager } from "../manager";
import {
    ConflictingSyncStartupBehaviour,
    Deserialisers,
    InitialValue,
    PSMConfig,
    PSMCreationConfig,
    NewSync,
    Sync,
    SyncOperationLogger,
    SyncsSource,
    toSync,
    Value,
} from "../types";
import {
    DefaultDeserialisers,
    getDefaultSyncStates,
    getSyncDataFromLocalStorage,
    resetToDefaultsOnOfflineTargets,
    resolveUpdateConflictsWithRemoteStateAndLatestEdit,
    saveSyncDataToLocalStorage,
} from "../utilities/defaults";
import { getValidationProblem, readFromSync, ReadChecks } from "../utilities/requests";
import { getSyncsFromConfig } from "../utilities/serialisation";
import { StartValue } from "./types";

/** Reads start with this, so that a failure to read or validate a target is reported as it happens */
const getStartupReadChecks = <V extends Value, T extends Target<any, any>>(
    getLatestConfig: () => Partial<PSMCreationConfig<V, T>>
): ReadChecks<T> => ({
    validate: (value) => getValidationProblem(value, getLatestConfig().validate),
    onUnreadableValue: (error, source) => getLatestConfig().onUnreadableValue?.(error, source),
});

// Only exported for testing
export const getPSMStartValue = <V extends Value, T extends Target<any, any>>(
    syncs: Sync<T>[],
    defaultInitialValue: InitialValue<V>,
    getLatestConfig: () => Partial<PSMCreationConfig<V, T>>,
    logger: () => SyncOperationLogger<Sync<T>>
) =>
    new Promise<StartValue<V, T>>(async (resolve, reject) => {
        /**
         * The handler and the initial value are application code, and either can throw. The executor
         * is async, so without this the error would be lost inside it and `create` would never settle.
         * Once a value has resolved the promise, a rejection does nothing.
         */
        try {
            const checks = getStartupReadChecks(getLatestConfig);

            // Pull values from all syncs
            const values = syncs.map((sync) => ({ sync, value: readFromSync<V, T>(logger, sync, checks) }));

            let resolved = false;

            // Ideally return from first returned value
            values.forEach(async ({ value }) => {
                const result = await value;
                if (result.type === "value" && result.value !== null && !resolved) {
                    resolved = true;
                    resolve({
                        type: "provisional",
                        value: result.value.value,
                        timestamp: result.value.timestamp,
                        values,
                    });
                }
            });

            // Otherwise, fallback to error handlers or defaults
            const results = await Promise.all(
                values.map(({ sync, value: result }) => result.then((value) => ({ sync, value })))
            );

            if (results.some(({ value }) => value.type === "error") && results.every(({ value }) => !value.value)) {
                const behaviour = await (
                    getLatestConfig().handleAllEmptyAndFailedSyncsOnStartup ?? resetToDefaultsOnOfflineTargets
                )(results as { sync: Sync<T>; value: ResultValueType<V> }[]);
                if (behaviour.behaviour === "VALUE" && !resolved) {
                    resolved = true;
                    resolve({ type: "final", value: behaviour.value, results, source: "FALLBACK" });
                    return;
                }
            }

            if (results.every(({ value }) => !value.value) && !resolved) {
                resolved = true;
                const value =
                    typeof defaultInitialValue !== "function"
                        ? defaultInitialValue
                        : await Promise.resolve(defaultInitialValue());
                resolve({ type: "final", value, results, source: "INITIAL" });
            }
        } catch (error) {
            reject(error);
        }
    });

/**
 * The saved syncs, or the defaults where nothing was saved. A saved list that can't be read - it
 * isn't JSON, an entry is malformed, or a target won't deserialise - is replaced by the defaults as a
 * whole, rather than repaired: a partial list could leave out the one target the data is kept in.
 * Failing instead would fail every time, since nothing would ever replace what was saved.
 */
const getStartingSyncs = async <T extends Target<any, any>>(
    getSyncData: () => string | null,
    getDefaultSyncs: () => Promise<NewSync<T>[]>,
    deserialisers: Deserialisers<T>
): Promise<{ syncs: Sync<T>[]; source: SyncsSource }> => {
    try {
        const saved = getSyncData();
        if (saved) return { syncs: await getSyncsFromConfig<T>(saved, deserialisers), source: "SAVED" };
    } catch (error) {
        console.error("PersonalStorageManager: the saved syncs could not be read, so the defaults are used", error);
        return { syncs: (await getDefaultSyncs()).map(toSync), source: "UNREADABLE" };
    }

    return { syncs: (await getDefaultSyncs()).map(toSync), source: "DEFAULT" };
};

const managers = new Set<string>();

/** Lets a closed manager's id be used again, rather than tripping the duplicate check below */
export const deregisterPSM = (id: string) => void managers.delete(id);

export async function createPSM<V extends Value, T extends Target<any, any>>(
    createPSMObject: (
        id: string,
        start: StartValue<V, T>,
        deserialisers: Deserialisers<T>,
        recents: ListBuffer<V>,
        config: PSMConfig<V, T>,
        resolveConflictingSyncValuesOnStartup: ConflictingSyncStartupBehaviour<V, T> | undefined
    ) => PersonalStorageManager<V, T>,
    defaultInitialValue: InitialValue<V>,
    initialisationConfig: Partial<PSMCreationConfig<V, T>> = {},
    getLatestConfig: () => Partial<PSMCreationConfig<V, T>> = () => ({}),
    maybeDeserialisers?: Deserialisers<T>
): Promise<CreatedPSM<V, T>> {
    /**
     * Parse defaults
     */
    const deserialisers = maybeDeserialisers ?? (DefaultDeserialisers as Deserialisers<T>);
    const {
        id = "psm-default-id",
        ignoreDuplicateCheck = false,
        getDefaultSyncs = (maybeDeserialisers ? () => Promise.resolve([]) : getDefaultSyncStates) as () => Promise<
            NewSync<T>[]
        >,
        getSyncData = () => getSyncDataFromLocalStorage(id),
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
     * Get initialisation values. A manager that fails to start never existed, so its id is freed for
     * the retry that the application may well make.
     */
    let getHandleSyncOperationLog = () => getLatestConfig().handleSyncOperationLog ?? noop;
    let start: StartValue<V, T>;
    let syncsSource: SyncsSource;
    try {
        const { syncs, source } = await getStartingSyncs(getSyncData, getDefaultSyncs, deserialisers);
        syncsSource = source;

        // Get initial values, including updating logger after PSM creation, and return manager
        start = await getPSMStartValue<V, T>(syncs, defaultInitialValue, getLatestConfig, () =>
            getHandleSyncOperationLog()
        );
    } catch (error) {
        deregisterPSM(id);
        throw error;
    }

    const latestConfig = getLatestConfig();
    const config: PSMConfig<V, T> = {
        pollPeriodInSeconds: latestConfig.pollPeriodInSeconds === undefined ? 10 : latestConfig.pollPeriodInSeconds,
        onValueUpdate: latestConfig.onValueUpdate ?? noop,
        saveSyncData: latestConfig.saveSyncData ?? ((data) => saveSyncDataToLocalStorage(data, id)),
        onSyncStatesUpdate: latestConfig.onSyncStatesUpdate ?? noop,
        resolveConflictingSyncsUpdate:
            latestConfig.resolveConflictingSyncsUpdate ?? resolveUpdateConflictsWithRemoteStateAndLatestEdit,
        handleSyncOperationLog: getHandleSyncOperationLog(),
        validate: latestConfig.validate ?? (() => null),
        onUnreadableValue: latestConfig.onUnreadableValue ?? noop,
    };
    const buffer = new ListBuffer<V>([], {
        maxLength: latestConfig.valueCacheCount,
        maxMillis: latestConfig.valueCacheMillis ?? 3000,
    });

    const manager = createPSMObject(
        id,
        start,
        deserialisers,
        buffer,
        config,
        latestConfig.resolveConflictingSyncValuesOnStartup
    );
    getHandleSyncOperationLog = () => manager.config.handleSyncOperationLog;
    return { manager, startSource: start.type === "provisional" ? "TARGET" : start.source, syncsSource };
}
