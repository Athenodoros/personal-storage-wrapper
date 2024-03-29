import { Sync, SyncOperationLogger } from "personal-storage-wrapper";

export type SyncStateConnection = "CONNECTED" | "OFFLINE" | "ERROR";
export type SyncStateOperation = "POLL" | "DOWNLOAD" | "UPLOAD" | null;

export interface SyncState {
    connection: SyncStateConnection;
    operation: SyncStateOperation;
}

export type SyncWithState = Sync & { state: SyncState };

const BaselineState: SyncState = { connection: "CONNECTED", operation: null };

export const trackSyncState = (
    callback: (syncs: SyncWithState[]) => void = () => void null
): {
    handleSyncOperationLog: SyncOperationLogger<Sync>;
    onSyncStatesUpdate: (syncs: Sync[]) => void;
    setCallback: (callback: (syncs: SyncWithState[]) => void) => void;
    getState: () => SyncWithState[];
} => {
    const map = new WeakMap<Sync["target"], SyncState>();
    let syncs: Sync[] = [];
    const getState = () => syncs.map((sync) => ({ ...sync, state: map.get(sync.target) ?? BaselineState }));
    const send = () => callback(getState());

    const onSyncStatesUpdate = (newSyncs: Sync[]) => {
        syncs = newSyncs;
        send();
    };

    const handleSyncOperationLog: SyncOperationLogger = ({ sync, stage, operation: rawOperation }) => {
        if (!syncs.some(({ target }) => target === sync.target)) syncs.push(sync);

        const connection: SyncStateConnection = stage === "OFFLINE" || stage === "ERROR" ? stage : "CONNECTED";
        const operation: SyncStateOperation = stage === "SUCCESS" ? null : stage === "START" ? rawOperation : null;
        map.set(sync.target, { connection, operation });

        send();
    };

    const setCallback = (newCallback: (syncs: SyncWithState[]) => void) => (callback = newCallback);

    return { onSyncStatesUpdate, handleSyncOperationLog, setCallback, getState };
};
