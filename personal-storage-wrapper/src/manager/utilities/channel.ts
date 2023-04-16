import { Target } from "../../targets";
import { TypedBroadcastChannel } from "../../utilities/channel";
import { ListBuffer } from "../../utilities/listbuffer";
import { Deserialisers, Sync, TimestampedValue, Value } from "../types";
import { getConfigFromSyncs, getSyncsFromConfig } from "./serialisation";

interface PSMBroadcastChannelValueMessage<V extends Value> {
    type: "VALUE";
    value: TimestampedValue<V>;
}

interface PSMBroadcastChannelSyncMessage {
    type: "UPDATE_SYNCS";
    syncs: string;
}

type PSMBroadcastChannelMessage<V extends Value> = PSMBroadcastChannelValueMessage<V> | PSMBroadcastChannelSyncMessage;

export class PSMBroadcastChannel<V extends Value, T extends Target<any, any>> {
    private channel: TypedBroadcastChannel<PSMBroadcastChannelMessage<V>>;
    public recents: ListBuffer<V>;

    constructor(
        id: string,
        recents: ListBuffer<V>,
        deserialisers: Deserialisers<T>,
        handleNewValue: (value: TimestampedValue<V>) => void,
        handleUpdateSyncs: (syncs: Sync<T>[]) => void
    ) {
        this.recents = recents;
        this.channel = new TypedBroadcastChannel<PSMBroadcastChannelMessage<V>>(id, async (message) => {
            if (message.type === "VALUE") {
                recents.push(message.value.value);
                handleNewValue(message.value);
            } else {
                const sync = await getSyncsFromConfig(message.syncs, deserialisers);
                if (sync) handleUpdateSyncs(sync);
            }
        });
    }

    sendNewValue = (value: TimestampedValue<V>) => this.channel.send({ type: "VALUE", value });
    sendUpdatedSyncs = (syncs: Sync<T>[]) =>
        this.channel.send({ type: "UPDATE_SYNCS", syncs: getConfigFromSyncs(syncs) });
}
