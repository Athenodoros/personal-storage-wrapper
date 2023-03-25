import { TypedBroadcastChannel } from "../utilities/channel";
import { ListBuffer } from "../utilities/listbuffer";
import { createPSM } from "./startup/constructor";
import { handleInitialSyncValuesAndGetResult } from "./startup/resolver";
import { StartValue } from "./startup/types";
import { Deserialisers, ManagerState, PSMConfig, SyncFromTargets, Targets, Value } from "./types";
import { DefaultTargetsType } from "./utilities/defaults";

export class PersonalStorageManager<V extends Value, T extends Targets = DefaultTargetsType> {
    private deserialisers: Deserialisers<T>;
    private state: ManagerState<V>;
    private syncs: SyncFromTargets<T>[];
    private channel: TypedBroadcastChannel<"VALUE" | "SYNCS">;
    private recents: ListBuffer<V>;
    public config: PSMConfig<V, T>;

    /**
     * Manager Initialisation
     */
    static create = createPSM;
    public constructor(
        start: StartValue<V, T>,
        deserialisers: Deserialisers<T>,
        recents: ListBuffer<V>,
        config: PSMConfig<V, T>
    ) {
        this.deserialisers = deserialisers;
        this.recents = recents;
        this.config = config;
        this.channel = new TypedBroadcastChannel<"VALUE" | "SYNCS">("psm-channel", () => {
            // TODO
            // If value, update value and don't write to syncs
            // For value: include some kind of hash on syncs to check for duplicates
            // If syncs, pass details for new/removed sync and add it (without syncing)
        });

        if (start.type === "final") {
            this.state = { type: "WAITING", value: start.value };
            this.syncs = start.syncs;
            return;
        }

        this.state = { type: "INITIALISING", value: start.value, writes: [] };
        this.syncs = start.syncs.map(({ sync }) => sync);

        // Wait for all results to return, handle results, and start polling
        Promise.all(start.syncs.map(({ sync, value }) => value.then((result) => ({ sync, result })))).then(
            (results) => {
                const value = handleInitialSyncValuesAndGetResult(
                    start.value,
                    results,
                    start.resolveConflictingSyncValuesOnStartup,
                    () => this.config.handleSyncOperationLog
                );

                // Use new value - set state and manage writes/sync updates, write out, and start polling
                TODO;
            }
        );
    }

    /**
     * Sync Management
     */
    public getSyncsState = (): SyncFromTargets<T>[] => [...this.syncs];
    public removeSync = async (sync: SyncFromTargets<T>): Promise<void> => {
        // TODO
        // Wait until end of next operation, then update list
    };
    public addSync = async (sync: SyncFromTargets<T>): Promise<void> => {
        // TODO
        // Wait until end of next operation, then update list
    };

    /**
     * Value Interactions
     */
    public getValue = (): V => this.state.value;
    public setValueAndPushToSyncs = (value: T): void => {
        // TODO
        // Update local quickly and then write out async
    };
}
