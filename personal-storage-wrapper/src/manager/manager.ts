import { TypedBroadcastChannel } from "../utilities/channel";
import { ListBuffer } from "../utilities/listbuffer";
import { DefaultTargetsType } from "./defaults";
import { createPSM, StartValue } from "./initialiser";
import { Deserialisers, ManagerState, PSMConfig, SyncFromTargets, Targets, Value } from "./types";

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
        });

        if (start.type === "final") {
            this.state = { type: "WAITING", value: start.value };
            this.syncs = start.syncs;
            return;
        }

        this.state = { type: "INITIALISING", value: start.value, writes: [] };
        this.syncs = start.syncs.map(({ sync }) => sync);
        // TODO: Listen to updates
    }

    /**
     * Sync Management
     */
    public getSyncsState = (): SyncFromTargets<T>[] => [...this.syncs];
    public removeSync = async (sync: SyncFromTargets<T>): Promise<void> => {
        // TODO
    };
    public addSync = async (sync: SyncFromTargets<T>): Promise<void> => {
        // TODO
    };

    /**
     * Value Interactions
     */
    public getValue = (): V => this.state.value;
    public setValueAndSync = (value: T): void => {
        // TODO
        // Update local quickly and then write out async
    };
}
