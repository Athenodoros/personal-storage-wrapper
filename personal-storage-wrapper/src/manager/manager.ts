import { DefaultTarget, resolveStartupConflictsWithRemoteStateAndLatestEdit } from "../main";
import { Target } from "../targets";
import { deepEquals, fromKeys, uniqEquals } from "../utilities/data";
import { ListBuffer } from "../utilities/listbuffer";
import { Operation, OperationArgument, OperationRunners, OperationState } from "./operations";
import { OperationRunOutput } from "./operations/types";
import { createPSMWithCache } from "./startup/cache";
import { createPSM } from "./startup/constructor";
import { handleInitialSyncValuesAndGetResult } from "./startup/resolver";
import { StartValue } from "./startup/types";
import {
    ConflictingSyncStartupBehaviour,
    Deserialisers,
    InitialValue,
    PSMConfig,
    PSMCreationConfig,
    Sync,
    TimestampedValue,
    Value,
    ValueUpdateOrigin,
} from "./types";
import { PSMBroadcastChannel } from "./utilities/channel";
import { writeToAndUpdateSync } from "./utilities/requests";
import { getConfigFromSyncs } from "./utilities/serialisation";

export class PersonalStorageManager<V extends Value, T extends Target<any, any> = DefaultTarget> {
    // The manager keeps a copy of the value to diff new values against, so that it doesn't repeatedly notify on the existing value
    // It is expected that usually this will be the same JS object as is held in application code, so the memory is not duplicated
    private value: TimestampedValue<V>;

    private operations: OperationState;
    private syncs: Sync<T>[];
    private channel: PSMBroadcastChannel<V, T>;
    public config: PSMConfig<V, T>;

    /**
     * Manager Initialisation
     */
    static createWithCache<V extends Value>(
        defaultInitialValue: InitialValue<V>,
        config?: Partial<PSMCreationConfig<V, DefaultTarget>>
    ): Promise<PersonalStorageManager<V, DefaultTarget>>;

    static createWithCache<V extends Value, T extends Target<any, any>>(
        defaultInitialValue: InitialValue<V>,
        config: Partial<PSMCreationConfig<V, T>>,
        deserialisers: Deserialisers<T>
    ): Promise<PersonalStorageManager<V, T>>;

    static createWithCache<V extends Value, T extends Target<any, any>>(
        defaultInitialValue: InitialValue<V>,
        initialisationConfig: Partial<PSMCreationConfig<V, T>> = {},
        maybeDeserialisers?: Deserialisers<T>
    ): Promise<PersonalStorageManager<V, T>> {
        return createPSMWithCache(
            (id, start, deserialisers, recents, config, resolveConflictingSyncValuesOnStartup) =>
                new PersonalStorageManager(
                    id,
                    start,
                    deserialisers,
                    recents,
                    config,
                    resolveConflictingSyncValuesOnStartup
                ),
            defaultInitialValue,
            initialisationConfig,
            maybeDeserialisers
        );
    }

    static create<V extends Value>(
        defaultInitialValue: InitialValue<V>,
        config?: Partial<PSMCreationConfig<V, DefaultTarget>>
    ): Promise<PersonalStorageManager<V, DefaultTarget>>;

    static create<V extends Value, T extends Target<any, any>>(
        defaultInitialValue: InitialValue<V>,
        config: Partial<PSMCreationConfig<V, T>>,
        deserialisers: Deserialisers<T>
    ): Promise<PersonalStorageManager<V, T>>;

    static create<V extends Value, T extends Target<any, any>>(
        defaultInitialValue: InitialValue<V>,
        initialisationConfig: Partial<PSMCreationConfig<V, T>> = {},
        maybeDeserialisers?: Deserialisers<T>
    ): Promise<PersonalStorageManager<V, T>> {
        return createPSM(
            (id, start, deserialisers, recents, config, resolveConflictingSyncValuesOnStartup) =>
                new PersonalStorageManager(
                    id,
                    start,
                    deserialisers,
                    recents,
                    config,
                    resolveConflictingSyncValuesOnStartup
                ),
            defaultInitialValue,
            initialisationConfig,
            () => initialisationConfig,
            maybeDeserialisers
        );
    }

    private constructor(
        id: string,
        start: StartValue<V, T>,
        deserialisers: Deserialisers<T>,
        recents: ListBuffer<V>,
        config: PSMConfig<V, T>,
        resolveConflictingSyncValuesOnStartup: ConflictingSyncStartupBehaviour<V, T> | undefined
    ) {
        this.operations = fromKeys(this.OPERATION_RUN_ORDER, () => []);
        this.channel = new PSMBroadcastChannel(
            id,
            recents,
            deserialisers,
            (value: TimestampedValue<V>) => {
                if (
                    value.timestamp > this.value.timestamp ||
                    (value.timestamp.valueOf() === this.value.timestamp.valueOf() &&
                        JSON.stringify(value.value) > JSON.stringify(this.value.value))
                )
                    this.setNewValue(value.value, "BROADCAST");
            },
            (syncs: Sync<T>[]) => this.enqueueOperation("update", syncs)
        );
        this.config = config;
        this.value = { value: start.value, timestamp: new Date() };
        this.config.onValueUpdate(start.value, "CREATION");

        if (start.type === "final") {
            this.syncs = start.results.map(({ sync }) => sync);
            this.onSyncsUpdate(false);

            const emptySyncs = start.results
                .filter(({ value }) => value.type === "value" && value.value === null)
                .map(({ sync }) => sync);
            if (emptySyncs.length) this.enqueueOperation("write", emptySyncs);

            return;
        }

        this.operations.running = "startup";
        this.syncs = start.values.map(({ sync }) => sync);

        // Wait for all results to return, handle results, and start polling
        const originalSyncs = this.getSyncsCopy();
        Promise.all(start.values.map(({ sync, value }) => value.then((result) => ({ sync, result })))).then(
            async (results) => {
                const value = await handleInitialSyncValuesAndGetResult(
                    start.value,
                    () => this.value.value,
                    results,
                    resolveConflictingSyncValuesOnStartup ?? resolveStartupConflictsWithRemoteStateAndLatestEdit,
                    this.logger
                );

                if (!deepEquals(value, start.value)) this.setNewValue(value, "CONFLICT");

                const emptySyncs = results
                    .filter(({ result }) => result.type === "value" && result.value === null)
                    .map(({ sync }) => sync);
                if (emptySyncs.length) this.enqueueOperation("write", emptySyncs);

                this.onSyncsUpdate(!deepEquals(originalSyncs, this.syncs));
                this.schedulePoll();
                this.operations.running = undefined;
                this.resolveQueuedOperations();
            }
        );
    }

    /**
     * Sync Management
     */

    private getSyncsCopy = (): Sync<T>[] => [...this.syncs.map((sync) => ({ ...sync }))];
    public getSyncsState = this.getSyncsCopy;
    public addTarget = (target: T, compressed: boolean = true): Promise<void> =>
        this.enqueueOperation("addition", { target, compressed });
    public addSync = (sync: Sync<T>): Promise<void> => this.enqueueOperation("addition", sync);
    public removeSync = (sync: Sync<T>): Promise<void> => this.enqueueOperation("removal", sync);
    public poll = (): Promise<void> => this.enqueueOperation("poll", null);

    /**
     * Value Interactions
     */

    public getValue = (): V => this.value.value;
    public setValue = (value: V): Promise<void> => {
        this.setNewValue(value, "LOCAL");
        return this.enqueueOperation("write", null);
    };

    /**
     * Internal Wrappers
     */

    private onSyncsUpdate = (sendToChannel: boolean = true) => {
        if (sendToChannel) this.channel.sendUpdatedSyncs(this.syncs);

        this.config.onSyncStatesUpdate(this.getSyncsCopy());
        this.config.saveSyncData(getConfigFromSyncs(this.syncs));
    };

    private setNewValue = (value: V, origin: ValueUpdateOrigin) => {
        this.value = { value, timestamp: new Date() };
        this.config.onValueUpdate(value, origin);

        if (origin !== "BROADCAST" && origin !== "CREATION") this.channel.sendNewValue(this.value);
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

        // Find operation to perform, in order of precedence
        const operation = this.OPERATION_RUN_ORDER.find((name) => this.operations[name].length);
        if (operation === undefined) return;

        this.operations.running = operation;
        const operations = this.operations[operation];
        this.operations[operation] = [];

        // Perform operations
        const originalSyncs = this.getSyncsCopy();
        const output = (await OperationRunners[operation]({
            args: operations.map(({ argument }) => argument as any),
            logger: this.logger,
            value: this.value.value,
            recents: this.channel.recents.values(),
            config: this.config,
            syncs: this.syncs,
        })) satisfies OperationRunOutput<V, T>;

        // Update syncs
        if (output.syncs && !deepEquals(this.syncs, output.syncs)) this.syncs = output.syncs;

        // Update value
        if (output.update && !deepEquals(output.update.value, this.value.value))
            this.setNewValue(output.update.value, output.update.origin);

        // Run writes
        if (output.writes && output.writes.length)
            await Promise.all(
                uniqEquals(output.writes, (s1, s2) => s1.target.equals(s2.target)).map(async (sync) => {
                    if (this.syncs.includes(sync)) await writeToAndUpdateSync(this.logger, sync, this.value.value);
                })
            );

        // Callback if dirty syncs
        if (!deepEquals(originalSyncs, this.syncs)) this.onSyncsUpdate(!output.skipChannel);

        // Resolve promises
        operations.forEach(({ callback }) => callback());

        // Rerun new operations
        this.operations.running = undefined;
        this.resolveQueuedOperations();
    };
}
