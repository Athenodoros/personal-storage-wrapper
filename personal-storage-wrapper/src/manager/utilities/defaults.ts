import { DropboxTarget } from "../../targets/dropbox";
import { DropboxTargetType } from "../../targets/dropbox/types";
import { GDriveTarget, GDriveTargetType } from "../../targets/gdrive";
import { IndexedDBTarget, IndexedDBTargetType } from "../../targets/indexeddb";
import { IndexedDBTargetSerialisationConfig } from "../../targets/indexeddb/types";
import { MemoryTarget, MemoryTargetType } from "../../targets/memory";
import { Deserialiser } from "../../targets/types";
import { maxBy } from "../../utilities/data";
import { OfflineSyncStartupBehaviour, Sync, SyncFromTargets, Targets, TimestampedValue, Value } from "../types";

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

export const getDefaultSyncStates = async (): Promise<
    [Sync<IndexedDBTargetType, IndexedDBTargetSerialisationConfig>]
> => {
    const target = await IndexedDBTarget.create();
    return [{ target, compressed: true }];
};

/**
 * Error handlers
 */
export const resetToDefaultsOnOfflineTargets = <V extends Value>(): Promise<OfflineSyncStartupBehaviour<V>> =>
    Promise.resolve({ behaviour: "DEFAULT" });

export const resolveStartupConflictsWithRemoteStateAndLatestEdit = <T extends Targets, V extends Value>(
    syncs: {
        sync: SyncFromTargets<T>;
        value: TimestampedValue<V>;
    }[]
): Promise<V> => {
    const priority = maxBy(
        syncs,
        ({ value }) => value.value !== null,
        ({ sync }) => sync.target.type !== IndexedDBTargetType && sync.target.type !== MemoryTargetType,
        ({ value }) => value.timestamp
    );

    if (!priority.value.value) throw Error("Invalid state: no available target values");

    return Promise.resolve(priority.value.value);
};

export const resolveUpdateConflictsWithRemoteStateAndLatestEdit = <V extends Value>(localState: V) =>
    Promise.resolve(localState);
