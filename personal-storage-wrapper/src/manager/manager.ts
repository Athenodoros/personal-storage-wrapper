import { TypedBroadcastChannel } from "../utilities/channel";
import { deepEquals } from "../utilities/data";
import { ListBuffer } from "../utilities/listbuffer";
import { createPSM } from "./startup/constructor";
import { handleInitialSyncValuesAndGetResult } from "./startup/resolver";
import { StartValue } from "./startup/types";
import {
    AdditionOperation,
    DEFAULT_MANAGER_STATE,
    Deserialisers,
    ManagerState,
    PSMConfig,
    RemovalOperation,
    SyncFromTargets,
    Targets,
    Value,
    WriteOperation,
} from "./types";
import { DefaultTargetsType } from "./utilities/defaults";
import { getConfigFromSyncs } from "./utilities/serialisation";

export class PersonalStorageManager<V extends Value, T extends Targets = DefaultTargetsType> {
    private value: V;
    private deserialisers: Deserialisers<T>;
    private state: ManagerState<V, T>;
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
        this.value = start.value;
        this.deserialisers = deserialisers;
        this.recents = recents;
        this.config = config;
        this.channel = new TypedBroadcastChannel<"VALUE" | "SYNCS">("psm-channel", () => {
            TODO;
            // If value, update value and don't write to syncs
            // For value: include some kind of hash on syncs to check for duplicates
            // If syncs, pass details for new/removed sync and add it (without syncing)
        });

        if (start.type === "final") {
            this.state = { type: "WAITING" };
            this.syncs = start.syncs;
            return;
        }

        this.state = { type: "INITIALISING", poll: false, writes: [], newSyncs: [], removeSyncs: [] };
        this.syncs = start.syncs.map(({ sync }) => sync);

        // Wait for all results to return, handle results, and start polling
        Promise.all(start.syncs.map(({ sync, value }) => value.then((result) => ({ sync, result })))).then(
            async (results) => {
                const { value, didUpdateSyncs } = await handleInitialSyncValuesAndGetResult(
                    start.value,
                    results,
                    start.resolveConflictingSyncValuesOnStartup,
                    () => this.config.handleSyncOperationLog
                );

                if (didUpdateSyncs) this.onSyncsUpdate();
                if (!deepEquals(value, start.value)) this.config.onValueUpdate(value);

                this.schedulePoll();
                this.resolveQueuedOperations();
            }
        );
    }

    /**
     * Sync Management
     */
    public getSyncsState = (): SyncFromTargets<T>[] => [...this.syncs];
    public addSync = (sync: SyncFromTargets<T>): Promise<void> =>
        new Promise((resolve) => {
            if (this.state.type !== "WAITING") this.state.newSyncs.push({ sync, callback: resolve });
            else this.resolveQueuedAdditions([{ sync, callback: resolve }]);
        });
    public removeSync = (sync: SyncFromTargets<T>): Promise<void> =>
        new Promise((resolve) => {
            if (this.state.type !== "WAITING") this.state.removeSyncs.push({ sync, callback: resolve });
            else this.resolveQueuedRemovals([{ sync, callback: resolve }]);
        });

    /**
     * Value Interactions
     */
    public getValue = (): V => this.value;
    public setValueAndPushToSyncs = (value: T): void => {
        TODO; // Update local quickly and then write out async
    };

    /**
     * Internal Wrappers
     */
    private onSyncsUpdate = () => {
        this.config.onSyncStatesUpdate(this.syncs);
        this.config.saveSyncData(getConfigFromSyncs(this.syncs));
    };

    private schedulePoll = () =>
        setTimeout(() => {
            // Schedule polls regardless of missing poll period, in case it's updated to a value
            if (this.config.pollPeriodInSeconds === null) this.schedulePoll();
            else if (this.state.type !== "WAITING") this.state.poll = true;
            else this.poll();
        }, (this.config.pollPeriodInSeconds ?? 10) * 1000);

    /**
     * Internal processing rules
     */
    private resolveQueuedOperations = (): void => {
        if (this.state.type === "WAITING") return;

        if (this.state.removeSyncs.length) return this.resolveQueuedRemovals();
        if (this.state.newSyncs.length) return this.resolveQueuedAdditions();
        if (this.state.writes.length) return this.resolveQueuedWrites();
        if (this.state.poll) return this.poll();

        this.state = { type: "WAITING" };
    };

    private resolveQueuedRemovals = (syncs: RemovalOperation<T>[] = []): void => {
        const removals = syncs.concat(this.state.type === "WAITING" ? [] : this.state.removeSyncs);
        if (removals.length === 0) return this.resolveQueuedOperations();

        this.state = {
            ...DEFAULT_MANAGER_STATE,
            ...this.state,
            removeSyncs: [],
            type: "REMOVING_SYNC",
        };

        const previous = this.syncs.length;
        this.syncs = this.syncs.filter((sync) => removals.every(({ sync: removal }) => sync !== removal));
        removals.forEach(({ callback }) => callback());

        if (this.syncs.length !== previous) this.onSyncsUpdate();

        this.resolveQueuedOperations();
    };

    private resolveQueuedAdditions = (syncs: AdditionOperation<T>[] = []) => {
        TODO;
    };

    private resolveQueuedWrites = (writes: WriteOperation<V>[] = []) => {
        TODO;
    };

    private poll = () => {
        TODO;
    };
}
