import { Value } from "./values";

export interface ManagerStartingState<V extends Value> {
    type: "STARTING";
    writes: {
        value: V;
        callback: () => void;
    }[];
}
export interface ManagerInitialisingState<V extends Value> {
    type: "INITIALISING";
    writes: {
        value: V;
        callback: () => void;
    }[];
    value: V;
}
export interface ManagerBlockedState<V extends Value> {
    type: "UPLOADING" | "POLLING" | "DOWNLOADING";
    writes: {
        value: V;
        callback: () => void;
    }[];
    poll: boolean;
    value: V;
}
export interface ManagerUnblockedState<V extends Value> {
    type: "WAITING";
    value: V;
}

export type ManagerState<V extends Value> =
    | ManagerStartingState<V>
    | ManagerInitialisingState<V>
    | ManagerBlockedState<V>
    | ManagerUnblockedState<V>;
