import { SyncFromTargets } from "./config";
import { Targets, Value } from "./values";

export interface WriteOperation<V extends Value> {
    value: V;
    callback: () => void;
}

export interface AdditionOperation<T extends Targets> {
    sync: SyncFromTargets<T>;
    background?: boolean; // Add in background because initial sync happened in other tab
    callback: () => void;
}

export interface RemovalOperation<T extends Targets> {
    sync: SyncFromTargets<T>;
    callback: () => void;
}

export interface ManagerOperatingState<V extends Value, T extends Targets> {
    type: "INITIALISING" | "UPLOADING" | "POLLING" | "DOWNLOADING" | "ADDING_SYNC" | "REMOVING_SYNC" | "UPDATING_SYNCS";

    poll: boolean;
    writes: WriteOperation<V>[];
    newSyncs: AdditionOperation<T>[];
    removeSyncs: RemovalOperation<T>[];
    updateSyncs?: SyncFromTargets<T>[];
}

export interface ManagerWaitingState {
    type: "WAITING";
}

export type ManagerState<V extends Value, T extends Targets> = ManagerOperatingState<V, T> | ManagerWaitingState;

export const DEFAULT_MANAGER_STATE = {
    poll: false,
    writes: [],
    newSyncs: [],
    removeSyncs: [],
};
