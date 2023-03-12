import { DropboxTarget } from "../targets/dropbox";
import { DropboxTargetType } from "../targets/dropbox/types";
import { GDriveTarget, GDriveTargetType } from "../targets/gdrive";
import { IndexedDBTarget, IndexedDBTargetType } from "../targets/indexeddb";
import { IndexedDBTargetSerialisationConfig } from "../targets/indexeddb/types";
import { MemoryTarget, MemoryTargetType } from "../targets/memory";
import { MemoryTargetSerialisationConfig } from "../targets/memory/types";
import { Deserialiser } from "../targets/types";
import { maxBy } from "../utilities/data";
import { OfflineSyncStartupBehaviour, Sync, SyncTypeWithValue, Targets, Value } from "./types";

/**
 * Deserialiser definitions
 */
export const DefaultDeserialisers = {
    [DropboxTargetType]: DropboxTarget.deserialise,
    [GDriveTargetType]: GDriveTarget.deserialise,
    [IndexedDBTargetType]: IndexedDBTarget.deserialise,
    [MemoryTargetType]: MemoryTarget.deserialise,
};
export type DefaultTargetsType = {
    [K in keyof typeof DefaultDeserialisers]: typeof DefaultDeserialisers[K] extends Deserialiser<K, infer Config>
        ? Config
        : never;
};

/**
 * Sync state storage
 */
const LOCAL_STORAGE_KEY = "personal-storage-manager-state";
export const getSyncDataFromLocalStorage = () => localStorage.getItem(LOCAL_STORAGE_KEY);
export const saveSyncDataToLocalStorage = (data: string) => localStorage.setItem(LOCAL_STORAGE_KEY, data);

export const getDefaultSyncStates = () =>
    new Promise<
        [
            | Sync<IndexedDBTargetType, IndexedDBTargetSerialisationConfig>
            | Sync<MemoryTargetType, MemoryTargetSerialisationConfig>
        ]
    >(async (resolve) => {
        const target = (await IndexedDBTarget.create()) ?? new MemoryTarget();
        resolve([
            {
                target,
                compressed: true,
                state: "SYNCED",
            },
        ] as [Sync<IndexedDBTargetType, IndexedDBTargetSerialisationConfig> | Sync<MemoryTargetType, MemoryTargetSerialisationConfig>]);
    });

/**
 * Error handlers
 */
export const resetToDefaultsOnOfflineTargets = <V extends Value>(): Promise<OfflineSyncStartupBehaviour<V>> =>
    Promise.resolve({ behaviour: "DEFAULT" });

export const resolveStartupConflictsWithRemoteStateAndLatestEdit = <T extends Targets, V extends Value>(
    syncs: SyncTypeWithValue<T, V>[]
): Promise<V> => {
    const priority = maxBy(
        syncs,
        ({ value }) => value.type === "value" && value.value !== null,
        ({ sync }) => sync.target.type !== IndexedDBTargetType && sync.target.type !== MemoryTargetType,
        ({ value }) => value.value?.timestamp
    );

    if (!priority.value.value) throw Error("Invalid state: no available target values");

    return Promise.resolve(priority.value.value.value);
};

export const resolveUpdateConflictsWithRemoteStateAndLatestEdit = <T extends Targets, V extends Value>(
    localState: V,
    _conflicts: SyncTypeWithValue<T, V>
) => Promise.resolve(localState);
