export type SyncState = "SYNCED" | "DOWNLOAD" | "UPLOAD" | "POLL" | "OFFLINE" | "ERROR";
import { Target } from "../../targets/types";

export interface Sync<Type extends string, Config> {
    // Sync Config
    target: Target<Type, Config>;
    compressed: boolean;

    // Sync Status
    desynced?: boolean;
    lastSeenWriteTime?: Date;

    // Observability for Applications
    state: SyncState;
}
