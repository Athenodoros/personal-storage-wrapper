import { TypedBroadcastChannel } from "../../utilities/channel";
import { Deserialisers, SyncFromTargets, Targets, Value } from "../types";
import { getConfigFromSyncs, getSyncsFromConfig } from "./serialisation";

interface PSMBroadcastChannelValueMessage<V extends Value> {
    type: "VALUE";
    value: V;
}

interface PSMBroadcastChannelSyncMessage {
    type: "UPDATE_SYNCS";
    syncs: string;
}

type PSMBroadcastChannelMessage<V extends Value> = PSMBroadcastChannelValueMessage<V> | PSMBroadcastChannelSyncMessage;

export class PSMBroadcastChannel<V extends Value, T extends Targets> {
    private channel: TypedBroadcastChannel<PSMBroadcastChannelMessage<V>>;

    constructor(
        deserialisers: Deserialisers<T>,
        handleNewValue: (value: V) => void,
        handleUpdateSyncs: (syncs: SyncFromTargets<T>[]) => void
    ) {
        this.channel = new TypedBroadcastChannel<PSMBroadcastChannelMessage<V>>("psm-channel", async (message) => {
            if (message.type === "VALUE") {
                handleNewValue(message.value);
            } else {
                const sync = await getSyncsFromConfig(message.syncs, deserialisers);
                if (sync) handleUpdateSyncs(sync);
            }
        });
    }

    sendNewValue = (value: V) => this.channel.send({ type: "VALUE", value });
    sendUpdatedSyncs = (syncs: SyncFromTargets<T>[]) =>
        this.channel.send({ type: "UPDATE_SYNCS", syncs: getConfigFromSyncs(syncs) });
}
