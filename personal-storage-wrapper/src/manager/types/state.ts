import { Value } from "./values";

export interface ManagerInitialisingState<V extends Value> {
    value: V;
    type: "INITIALISING";

    writes: {
        value: V;
        callback: () => void;
    }[];
}
export interface ManagerRunningState<V extends Value> {
    value: V;
    type: "UPLOADING" | "POLLING" | "DOWNLOADING";

    writes: {
        value: V;
        callback: () => void;
    }[];
    poll: boolean;
}
export interface ManagerWaitingState<V extends Value> {
    value: V;
    type: "WAITING";
}

export type ManagerState<V extends Value> =
    | ManagerInitialisingState<V>
    | ManagerRunningState<V>
    | ManagerWaitingState<V>;
