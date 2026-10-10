import { DefaultTarget, resolveStartupConflictsWithRemoteStateAndLatestEdit } from "../main";
import { Target } from "../targets";
import { deepEquals, fromKeys, noop, uniqEquals } from "../utilities/data";
import { ListBuffer } from "../utilities/listbuffer";
import { Operation, OperationArgument, OperationRunners, OperationState } from "./operations";
import { OperationRunOutput } from "./operations/types";
import { createPSMWithCache } from "./startup/cache";
import { createPSM, deregisterPSM } from "./startup/constructor";
import { resolveInitialSyncValues, writeInitialSyncValues } from "./startup/resolver";
import { StartValue } from "./startup/types";
import {
    ConflictingSyncStartupBehaviour,
    Deserialisers,
    InitialValue,
    PSMConfig,
    PSMCreationConfig,
    SaveResult,
    StartSource,
    Sync,
    SyncsSource,
    TimestampedValue,
    Value,
    ValueUpdateOrigin,
} from "./types";
import { PSMBroadcastChannel } from "./utilities/channel";
import { clearSyncDataFromLocalStorage } from "./utilities/defaults";
import { getValidationProblem, reportUnreadableValue, writeToAndUpdateSync } from "./utilities/requests";
import { getConfigFromSyncs } from "./utilities/serialisation";

/**
 * A new manager, and where the value it was created with came from - which matters once, to the code
 * that created it, and so is returned with it rather than kept on the manager
 */
export interface CreatedPSM<V extends Value, T extends Target<any, any> = DefaultTarget> {
    manager: PersonalStorageManager<V, T>;
    startSource: StartSource;
    syncsSource: SyncsSource;
}

export class PersonalStorageManager<V extends Value, T extends Target<any, any> = DefaultTarget> {
    // The manager keeps a copy of the value to diff new values against, so that it doesn't repeatedly notify on the existing value
    // It is expected that usually this will be the same JS object as is held in application code, so the memory is not duplicated
    private value: TimestampedValue<V>;

    private operations: OperationState;
    private syncs: Sync<T>[];
    private channel: PSMBroadcastChannel<V, T>;
    public config: PSMConfig<V, T>;

    private id: string;
    private closed: boolean = false;
    private pollTimeout: ReturnType<typeof setTimeout> | undefined;

    /**
     * Removes the list of syncs a manager with this id keeps in localStorage by default, so that the
     * next manager created with it starts from its default syncs. It does nothing to the targets, and
     * nothing for a manager given its own `getSyncData` and `saveSyncData`.
     */
    static clearSyncData = (id?: string) => clearSyncDataFromLocalStorage(id);

    /**
     * Manager Initialisation
     */
    static createWithCache<V extends Value>(
        defaultInitialValue: InitialValue<V>,
        config?: Partial<PSMCreationConfig<V, DefaultTarget>>
    ): Promise<CreatedPSM<V, DefaultTarget>>;

    static createWithCache<V extends Value, T extends Target<any, any>>(
        defaultInitialValue: InitialValue<V>,
        config: Partial<PSMCreationConfig<V, T>>,
        deserialisers: Deserialisers<T>
    ): Promise<CreatedPSM<V, T>>;

    static createWithCache<V extends Value, T extends Target<any, any>>(
        defaultInitialValue: InitialValue<V>,
        initialisationConfig: Partial<PSMCreationConfig<V, T>> = {},
        maybeDeserialisers?: Deserialisers<T>
    ): Promise<CreatedPSM<V, T>> {
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
    ): Promise<CreatedPSM<V, DefaultTarget>>;

    static create<V extends Value, T extends Target<any, any>>(
        defaultInitialValue: InitialValue<V>,
        config: Partial<PSMCreationConfig<V, T>>,
        deserialisers: Deserialisers<T>
    ): Promise<CreatedPSM<V, T>>;

    static create<V extends Value, T extends Target<any, any>>(
        defaultInitialValue: InitialValue<V>,
        initialisationConfig: Partial<PSMCreationConfig<V, T>> = {},
        maybeDeserialisers?: Deserialisers<T>
    ): Promise<CreatedPSM<V, T>> {
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
        this.id = id;
        this.operations = fromKeys(this.OPERATION_RUN_ORDER, () => []);
        this.channel = new PSMBroadcastChannel(
            id,
            recents,
            deserialisers,
            (value: TimestampedValue<V>) => {
                // Another context may run a different version of the application, and send a value
                // this one can't use: it is refused, and the application told
                const problem = getValidationProblem(value.value, this.config.validate);
                if (problem !== null) {
                    const error = {
                        type: "error",
                        error: "CORRUPT_VALUE",
                        detail: problem,
                        decoded: value.value,
                    } as const;
                    return reportUnreadableValue(this.config.onUnreadableValue, error, { type: "BROADCAST" });
                }

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

        /**
         * Stamped with when it was saved, not when it was read. Another context's newer value is only
         * taken if it is stamped later than this one, and a value that was being saved while this one
         * was read would otherwise lose to it and be dropped. A value that no target held is older than
         * anything that has been saved.
         */
        this.value = { value: start.value, timestamp: start.type === "provisional" ? start.timestamp : new Date(0) };
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
                if (this.closed) return;

                const value = await resolveInitialSyncValues(
                    start.value,
                    () => this.value.value,
                    results,
                    resolveConflictingSyncValuesOnStartup ?? resolveStartupConflictsWithRemoteStateAndLatestEdit
                );

                // Taken on before it is written, so that it can't replace an edit made while it is written,
                // and compared with the value held now, since the application may already hold it
                if (!deepEquals(value, this.value.value)) this.setNewValue(value, "CONFLICT");
                await writeInitialSyncValues(this.value.value, results, this.logger);

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
    /**
     * Starts syncing to a target. A value already there is reconciled with the manager's by
     * `resolveConflictingSyncsUpdate`, unless it is `replacing`: a value the application read there
     * itself and has decided the manager's value replaces, which is then written over without asking.
     */
    public addTarget = (target: T, { compressed = true, replacing }: AdditionOptions<V> = {}): Promise<void> =>
        this.enqueueOperation("addition", { sync: { target, compressed }, replacing }).then(ignoreResult);
    public addSync = (sync: Sync<T>): Promise<void> => this.enqueueOperation("addition", { sync }).then(ignoreResult);
    public removeSync = (sync: Sync<T>): Promise<void> => this.enqueueOperation("removal", sync).then(ignoreResult);
    public poll = (): Promise<void> => this.enqueueOperation("poll", null).then(ignoreResult);

    /**
     * Value Interactions
     */

    public getValue = (): V => this.value.value;
    /** Resolves once the value, or a later one, has been written, with which syncs saved it */
    public setValue = (value: V): Promise<SaveResult<T>> => {
        if (this.closed) return Promise.resolve({ saved: [], failed: this.getSyncsCopy() });

        this.setNewValue(value, "LOCAL");
        return this.enqueueOperation("write", "ALL");
    };

    /**
     * Shutdown
     *
     * Lets go of everything the manager holds open - the poll timer and the broadcast channel - and
     * makes every operation from then on a no-op. Without this a manager lives as long as the page
     * does, which matters most in tests, where each new manager would otherwise go on receiving the
     * broadcasts of every manager created before it.
     */
    public close = () => {
        if (this.closed) return;

        this.closed = true;
        if (this.pollTimeout !== undefined) clearTimeout(this.pollTimeout);
        this.channel.close();
        deregisterPSM(this.id);
    };

    /**
     * Internal Wrappers
     */

    private onSyncsUpdate = (sendToChannel: boolean = true) => {
        // An operation that was running when the manager closed still finishes, and what it ends with is
        // no longer the manager's to report or save: the application may have cleared the saved list since
        if (this.closed) return;

        if (sendToChannel) this.channel.sendUpdatedSyncs(this.syncs);

        this.config.onSyncStatesUpdate(this.getSyncsCopy());
        this.config.saveSyncData(getConfigFromSyncs(this.syncs));
    };

    private setNewValue = (value: V, origin: ValueUpdateOrigin) => {
        this.value = { value, timestamp: new Date() };
        this.config.onValueUpdate(value, origin);

        if (origin !== "BROADCAST" && origin !== "CREATION" && !this.closed) this.channel.sendNewValue(this.value);
    };

    private schedulePoll = () => {
        if (this.closed) return;

        this.pollTimeout = setTimeout(() => {
            if (this.closed) return;

            // Schedule polls regardless of missing poll period, in case it's updated to a value
            if (this.config.pollPeriodInSeconds === null) this.schedulePoll();
            else this.enqueueOperation("poll", null);
        }, (this.config.pollPeriodInSeconds ?? 10) * 1000);
    };

    private logger = () => this.config.handleSyncOperationLog;

    /**
     * Internal processing rules
     */

    private enqueueOperation = <O extends Operation>(operation: O, argument: OperationArgument<O>) =>
        new Promise<SaveResult<T>>((callback) => {
            if (this.closed) return callback({ saved: [], failed: this.getSyncsCopy() });

            this.operations[operation].push({ argument, callback } as any);
            this.resolveQueuedOperations();
        });

    private OPERATION_RUN_ORDER = ["update", "removal", "addition", "write", "poll"] as Operation[];
    private resolveQueuedOperations = async (): Promise<void> => {
        // Handle "running state"
        if (this.closed || this.operations.running) return;

        // Find operation to perform, in order of precedence
        const operation = this.OPERATION_RUN_ORDER.find((name) => this.operations[name].length);
        if (operation === undefined) return;

        this.operations.running = operation;
        const operations = this.operations[operation];
        this.operations[operation] = [];
        const saved: Sync<T>[] = [];
        let conflicted = false;

        /**
         * Whatever happens in here, the queue has to be handed back. An operation runner that
         * throws would otherwise leave `running` set for the life of the page: every later write,
         * addition and poll would queue behind it and never run, and the promises they were given
         * would never settle, so nothing would report a problem either.
         */
        try {
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
                        if (!this.syncs.includes(sync)) return;

                        const outcome = await writeToAndUpdateSync(this.logger, sync, this.value.value);
                        if (outcome === "SAVED") saved.push(sync);
                        if (outcome === "CONFLICT") conflicted = true;
                    })
                );

            // Callback if dirty syncs
            if (!deepEquals(originalSyncs, this.syncs)) this.onSyncsUpdate(!output.skipChannel);

            // Runs once this operation hands back the queue, in the finally below. A refused write asks for one
            // too, so that what was written in its place is read at once.
            if ((output.poll || conflicted) && !this.operations.poll.length)
                this.operations.poll.push({ argument: null, callback: noop });
        } catch (error) {
            console.error("PersonalStorageManager: the " + operation + " operation failed", error);
        } finally {
            // Resolve promises
            // In the order the syncs are held, rather than the order the writes happened to finish in,
            // and copied, like `getSyncsState`, so that the caller can't change the manager's own
            const result = {
                saved: this.syncs.filter((sync) => saved.includes(sync)).map((sync) => ({ ...sync })),
                failed: this.syncs.filter((sync) => !saved.includes(sync)).map((sync) => ({ ...sync })),
            };
            operations.forEach(({ callback }) => callback(result));

            // Rerun new operations
            this.operations.running = undefined;
            this.resolveQueuedOperations();
        }
    };
}

const ignoreResult = () => undefined;

export interface AdditionOptions<V extends Value> {
    compressed?: boolean;
    replacing?: V;
}
