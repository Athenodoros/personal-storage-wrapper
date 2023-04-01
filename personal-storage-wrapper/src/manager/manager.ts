import { deepEquals, fromKeys, uniqBy } from "../utilities/data";
import { ListBuffer } from "../utilities/listbuffer";
import { Operation, OperationArgument, OperationRunners, OperationState } from "./operations";
import { OperationRunOutput } from "./operations/types";
import { createPSM } from "./startup/constructor";
import { handleInitialSyncValuesAndGetResult } from "./startup/resolver";
import { StartValue } from "./startup/types";
import {
    Deserialisers,
    InitialValue,
    PSMConfig,
    PSMCreationConfig,
    SyncFromTargets,
    Targets,
    Value,
    ValueUpdateOrigin,
} from "./types";
import { PSMBroadcastChannel } from "./utilities/channel";
import { DefaultTargetsType } from "./utilities/defaults";
import { writeToAndUpdateSync } from "./utilities/requests";
import { getConfigFromSyncs } from "./utilities/serialisation";

export class PersonalStorageManager<V extends Value, T extends Targets = DefaultTargetsType> {
    private value: V;
    private operations: OperationState;
    private syncs: SyncFromTargets<T>[];
    private channel: PSMBroadcastChannel<V, T>;
    public config: PSMConfig<V, T>;

    /**
     * Manager Initialisation
     */
    static create<V extends Value>(
        initialValue: InitialValue<V>,
        config?: Partial<PSMCreationConfig<V, DefaultTargetsType>>
    ): Promise<PersonalStorageManager<V, DefaultTargetsType>>;

    static create<V extends Value, T extends Targets>(
        initialValue: InitialValue<V>,
        config: Partial<PSMCreationConfig<V, T>>,
        deserialisers: Deserialisers<T>
    ): Promise<PersonalStorageManager<V, T>>;

    static create<V extends Value, T extends Targets>(
        initialValue: InitialValue<V>,
        initialisationConfig: Partial<PSMCreationConfig<V, T>> = {},
        maybeDeserialisers?: Deserialisers<T>
    ): Promise<PersonalStorageManager<V, T>> {
        return createPSM(
            (id, start, deserialisers, recents, config) =>
                new PersonalStorageManager(id, start, deserialisers, recents, config),
            initialValue,
            initialisationConfig,
            maybeDeserialisers
        );
    }

    private constructor(
        id: string,
        start: StartValue<V, T>,
        deserialisers: Deserialisers<T>,
        recents: ListBuffer<V>,
        config: PSMConfig<V, T>
    ) {
        this.operations = { running: false, ...fromKeys(this.OPERATION_RUN_ORDER, []) };
        this.channel = new PSMBroadcastChannel(
            id + "-channel",
            recents,
            deserialisers,
            (value: V) => this.setNewValue(value, "BROADCAST"),
            (syncs: SyncFromTargets<T>[]) => this.enqueueOperation("update", syncs)
        );
        this.value = start.value;
        this.config = config;

        if (start.type === "final") {
            this.syncs = start.syncs;
            this.config.onSyncStatesUpdate(this.syncs);
            return;
        }

        this.operations.running = true;
        this.syncs = start.syncs.map(({ sync }) => sync);
        this.config.onSyncStatesUpdate(this.syncs);

        // Wait for all results to return, handle results, and start polling
        const originalSyncs = this.getSyncsCopy();
        Promise.all(start.syncs.map(({ sync, value }) => value.then((result) => ({ sync, result }))))
            .then((results) => handleInitialSyncValuesAndGetResult(start.value, results, start.resolve, this.logger))
            .then((value) => {
                if (!deepEquals(originalSyncs, this.syncs)) this.onSyncsUpdate();
                if (!deepEquals(value, start.value)) this.setNewValue(value, "CONFLICT");

                this.schedulePoll();
                this.operations.running = false;
                this.resolveQueuedOperations();
            });
    }

    /**
     * Sync Management
     */

    private getSyncsCopy = (): SyncFromTargets<T>[] => [...this.syncs.map((sync) => ({ ...sync }))];
    public getSyncsState = this.getSyncsCopy;
    public addSync = (sync: SyncFromTargets<T>): Promise<void> => this.enqueueOperation("addition", sync);
    public removeSync = (sync: SyncFromTargets<T>): Promise<void> => this.enqueueOperation("removal", sync);

    /**
     * Value Interactions
     */

    public getValue = (): V => this.value;
    public setValueAndPushToSyncs = (value: V): void => this.setNewValue(value, "LOCAL");

    /**
     * Internal Wrappers
     */

    private onSyncsUpdate = (sendToChannel: boolean = true) => {
        if (sendToChannel) this.channel.sendUpdatedSyncs(this.syncs);

        this.config.onSyncStatesUpdate(this.syncs);
        this.config.saveSyncData(getConfigFromSyncs(this.syncs));
    };

    private setNewValue = (value: V, origin: ValueUpdateOrigin) => {
        this.value = value;
        this.config.onValueUpdate(value, origin);
    };

    private schedulePoll = () =>
        setTimeout(() => {
            // Schedule polls regardless of missing poll period, in case it's updated to a value
            if (this.config.pollPeriodInSeconds === null) this.schedulePoll();
            else this.enqueueOperation("poll", null);
        }, (this.config.pollPeriodInSeconds ?? 10) * 1000);

    private logger = () => this.config.handleSyncOperationLog;

    /**
     * Internal processing rules
     */

    private enqueueOperation = <O extends Operation>(operation: O, argument: OperationArgument<O>) =>
        new Promise<void>((callback) => {
            this.operations[operation].push({ argument, callback } as any);
            this.resolveQueuedOperations();
        });

    private OPERATION_RUN_ORDER = ["update", "removal", "addition", "write", "poll"] as Operation[];
    private resolveQueuedOperations = async (): Promise<void> => {
        // Handle "running state"
        if (this.operations.running) return;
        this.operations.running = true;

        // Find operation to perform, in order of precedence
        const operation = this.OPERATION_RUN_ORDER.find((name) => this.operations[name].length);
        if (operation === undefined) return;
        this.operations[operation] = [];

        // Perform operations
        const originalSyncs = this.getSyncsCopy();
        const output = (await OperationRunners[operation]({
            args: this.operations[operation] as any,
            logger: this.logger,
            value: this.value,
            recents: this.channel.recents.values(),
            config: this.config,
            syncs: this.syncs,
        })) satisfies OperationRunOutput<V, T>;

        // Update syncs
        if (output.syncs && !deepEquals(this.syncs, output.syncs)) this.syncs = output.syncs;

        // Update value
        if (output.update && !deepEquals(output.update.value, this.value))
            this.setNewValue(output.update.value, output.update.origin);

        // Run writes
        if (output.writes && output.writes.length)
            await Promise.all(
                uniqBy(output.writes, (sync) => sync.target).map((sync) =>
                    writeToAndUpdateSync(this.logger, sync, this.value)
                )
            );

        // Callback if dirty syncs
        if (!deepEquals(originalSyncs, this.syncs)) this.onSyncsUpdate(!output.skipChannel);

        // Rerun new operations
        this.operations.running = false;
        this.resolveQueuedOperations();
    };
}
