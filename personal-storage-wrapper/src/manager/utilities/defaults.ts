import { Target } from "../../targets";
import { DropboxTarget } from "../../targets/dropbox";
import { DropboxTargetType } from "../../targets/dropbox/types";
import { GDriveTarget, GDriveTargetType } from "../../targets/gdrive";
import { IndexedDBTarget, IndexedDBTargetType } from "../../targets/indexeddb";
import { MemoryTarget, MemoryTargetType } from "../../targets/memory";
import { deepEquals, maxBy } from "../../utilities/data";
import { Deserialisers, OfflineSyncStartupBehaviour, Sync, TimestampedValue, Value } from "../types";

/**
 * Deserialiser definitions
 */
export type DefaultTarget = DropboxTarget | GDriveTarget | IndexedDBTarget | MemoryTarget;
export const DefaultDeserialisers: Deserialisers<DefaultTarget> = {
    [DropboxTargetType]: DropboxTarget.deserialise,
    [GDriveTargetType]: GDriveTarget.deserialise,
    [IndexedDBTargetType]: IndexedDBTarget.deserialise,
    [MemoryTargetType]: MemoryTarget.deserialise,
};

/**
 * Sync state storage
 */
const LOCAL_STORAGE_KEY = "personal-storage-manager-state";
export const getSyncDataFromLocalStorage = () => localStorage.getItem(LOCAL_STORAGE_KEY);
export const saveSyncDataToLocalStorage = (data: string) => localStorage.setItem(LOCAL_STORAGE_KEY, data);

export const getDefaultSyncStates = async (): Promise<[Sync<IndexedDBTarget>]> => {
    const target = await IndexedDBTarget.create();
    return [{ target, compressed: true }];
};

/**
 * Error handlers
 */
export const resetToDefaultsOnOfflineTargets = <V extends Value>(): Promise<OfflineSyncStartupBehaviour<V>> =>
    Promise.resolve({ behaviour: "DEFAULT" });

export const resolveStartupConflictsWithRemoteStateAndLatestEdit = <T extends Target<any, any>, V extends Value>(
    _originalValue: V,
    _currentValue: V,
    syncs: {
        sync: Sync<T>;
        value: TimestampedValue<V>;
    }[]
): Promise<V> => {
    const priority = maxBy(
        syncs,
        ({ value }) => value.value !== null,
        ({ sync }) => !(sync.target instanceof IndexedDBTarget) && !(sync.target instanceof MemoryTarget),
        ({ value }) => value.timestamp
    );

    if (!priority.value.value) throw Error("Invalid state: no available target values");

    if (deepEquals(priority.value.value, _originalValue)) return Promise.resolve(_currentValue);
    return Promise.resolve(priority.value.value);
};

export const resolveUpdateConflictsWithRemoteStateAndLatestEdit = <V extends Value>(localState: V) =>
    Promise.resolve(localState);
