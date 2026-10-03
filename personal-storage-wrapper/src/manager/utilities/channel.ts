import { Target } from "../../targets";
import { TypedBroadcastChannel } from "../../utilities/channel";
import { noop } from "../../utilities/data";
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

const hasLocks = () => typeof navigator !== "undefined" && "locks" in navigator;

export class PSMBroadcastChannel<V extends Value, T extends Target<any, any>> {
    private channel: TypedBroadcastChannel<PSMBroadcastChannelMessage<V>>;
    public recents: ListBuffer<V>;

    private closed: boolean = false;
    private lockPrefix: string;
    private lockName: string;
    private releaseLock: () => void = noop;

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

        /**
         * Every channel holds a lock of its own for as long as it is open, which is how another channel
         * with the same id knows that anyone is listening - and the browser lets go of it when the
         * context goes away, however it goes. It is asked for once the channel is listening, so that a
         * channel which sees the lock is never sending to one that would miss the message.
         */
        this.lockPrefix = "personal-storage-wrapper:" + id + ":";
        this.lockName = this.lockPrefix + Math.random().toString(36).slice(2);
        if (hasLocks()) {
            const held = new Promise<void>((resolve) => (this.releaseLock = resolve));
            navigator.locks.request(this.lockName, () => held).catch(noop);
        }
    }

    /**
     * Sending a value copies all of it, whether or not anything receives it, so with no other context
     * open it is not sent at all. Each value is still sent on its own rather than only the latest of
     * several: another context recognises the values that this one wrote to targets by its `recents`,
     * and one missing from them would be taken for a conflicting remote edit.
     */
    sendNewValue = (value: TimestampedValue<V>) =>
        this.hasListeners().then((listened) => {
            // Posting to a closed channel throws
            if (listened && !this.closed) this.channel.send({ type: "VALUE", value });
        });
    sendUpdatedSyncs = (syncs: Sync<T>[]) =>
        this.channel.send({ type: "UPDATE_SYNCS", syncs: getConfigFromSyncs(syncs) });

    /**
     * Whether another channel with this id is open, judged by the locks they hold rather than by
     * counting holders, since this channel's own lock may not have been granted yet. Without the Web
     * Locks API - an insecure context, or an older browser - there is no telling, so it is assumed.
     */
    private hasListeners = async (): Promise<boolean> => {
        if (!hasLocks()) return true;

        try {
            const { held = [] } = await navigator.locks.query();
            return held.some(({ name }) => name !== this.lockName && name?.startsWith(this.lockPrefix));
        } catch {
            return true;
        }
    };

    close = () => {
        this.closed = true;
        this.releaseLock();
        this.channel.close();
    };
}
