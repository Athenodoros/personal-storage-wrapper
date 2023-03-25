import { Sync } from "./syncs";

export type SyncOperation = "POLL" | "UPLOAD" | "DOWNLOAD";
export type SyncLogStage = "START" | "SUCCESS" | "OFFLINE" | "ERROR";

export interface SyncOperationLog<SyncType extends Sync<any, any> = Sync<any, any>> {
    operation: SyncOperation;
    stage: SyncLogStage;
    sync: SyncType;
}

export type SyncOperationLogger<SyncType extends Sync<any, any> = Sync<any, any>> = (
    log: SyncOperationLog<SyncType>
) => void;
