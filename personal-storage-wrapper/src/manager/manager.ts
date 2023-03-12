import { TypedBroadcastChannel } from "../utilities/channel";
import { ListBuffer } from "../utilities/listbuffer";
import { createPSM } from "./constructor";
import {
    DefaultTargetsType
} from "./defaults";
import { ConflictingSyncBehaviour, Deserialisers, InitialValue, ManagerState, PSMConfig, SyncOperationLog, SyncType, Targets, Value } from "./types";

export class PersonalStorageManager<V extends Value, T extends Targets = DefaultTargetsType> {
    private deserialisers: Deserialisers<T>;
    private state: ManagerState<V>;
    private syncs: SyncType<T>[];
    private channel: TypedBroadcastChannel<"VALUE" | "SYNCS">;
    private recents: ListBuffer<V>;

    // Updates
    pollPeriodInSeconds: number | null;
    onValueUpdate: (value: V) => void;
    handleSyncOperationLog: (log: SyncOperationLog<SyncType<T>>) => void;

    // Syncs Config
    getSyncData: () => string | null;
    saveSyncData: (data: string) => void;
    onSyncStatesUpdate: (sync: SyncType<T>[]) => void;

    // Conflict Handlers
    resolveConflictingSyncUpdate: ConflictingSyncBehaviour<T, V>;
    
    /**
     * Manager Initialisation
     */
    static create = createPSM;
    constructor(initialValue: InitialValue<V>, config: PSMConfig<V, T>, deserialisers: Deserialisers<T>) {

    }

    /**
     * Sync Management
     */
    getSyncsState = (): SyncType<T>[]    => [...this.syncs];
    removeSync = (sync: SyncType<T>): Promise<void>;
    addSync = (sync: SyncType<T>): Promise<void>;

    /**
     * Value Interactions
     */
    getValue = (): V | null => (this.state.type === "STARTING" ? null : this.state.value);
    setValueAndSync(value: T): void; // Update local quickly and write async
}
