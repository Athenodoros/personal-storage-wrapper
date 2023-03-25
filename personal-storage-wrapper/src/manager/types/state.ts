import { SyncFromTargets } from "./config";
import { Targets, Value } from "./values";

export interface ManagerInitialisingState<V extends Value, T extends Targets> {
    value: V;
    type: "INITIALISING";

    writes: {
        value: V;
        callback: () => void;
    }[];
    newSyncs: {
        sync: SyncFromTargets<T>;
        background: boolean; // Add in background because initial sync happened in other tab
        callback: () => void;
    }[];
    removeSyncs: {
        sync: SyncFromTargets<T>;
        callback: () => void;
    }[];
}
export interface ManagerRunningState<V extends Value, T extends Targets> {
    value: V;
    type: "UPLOADING" | "POLLING" | "DOWNLOADING" | "ADDING_SYNC";

    poll: boolean;
    writes: {
        value: V;
        callback: () => void;
    }[];
    newSyncs: {
        sync: SyncFromTargets<T>;
        background: boolean; // Add in background because initial sync happened in other tab
        callback: () => void;
    }[];
    removeSyncs: {
        sync: SyncFromTargets<T>;
        callback: () => void;
    }[];
}
export interface ManagerWaitingState<V extends Value> {
    value: V;
    type: "WAITING";
}

export type ManagerState<V extends Value, T extends Targets> =
    | ManagerInitialisingState<V, T>
    | ManagerRunningState<V, T>
    | ManagerWaitingState<V>;
