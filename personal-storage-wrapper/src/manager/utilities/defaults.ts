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
const DEFAULT_IDS = [undefined, "psm-default-id", "psm-default-cache-id"];

/**
 * Each manager keeps its syncs under a key of its own, so that two on one origin do not share a list of
 * targets. A manager without an id of its own keeps the key that every manager used to share.
 */
const getSyncDataKey = (id?: string) => (DEFAULT_IDS.includes(id) ? LOCAL_STORAGE_KEY : LOCAL_STORAGE_KEY + "-" + id);

/**
 * A browser can refuse localStorage altogether, and throw on any use of it. The syncs then come from the
 * defaults on every load, and nothing is remembered - which is no worse than a first load.
 */
export const getSyncDataFromLocalStorage = (id?: string) => {
    try {
        return localStorage.getItem(getSyncDataKey(id));
    } catch {
        return null;
    }
};
export const saveSyncDataToLocalStorage = (data: string, id?: string) => {
    try {
        localStorage.setItem(getSyncDataKey(id), data);
    } catch {
        // See above
    }
};
export const clearSyncDataFromLocalStorage = (id?: string) => {
    try {
        localStorage.removeItem(getSyncDataKey(id));
    } catch {
        // See above
    }
};

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
    originalValue: V,
    getCurrentValue: () => V,
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

    if (deepEquals(priority.value.value, originalValue)) return Promise.resolve(getCurrentValue());
    return Promise.resolve(priority.value.value);
};

export const resolveUpdateConflictsWithRemoteStateAndLatestEdit = <V extends Value>(localState: V) =>
    Promise.resolve(localState);
