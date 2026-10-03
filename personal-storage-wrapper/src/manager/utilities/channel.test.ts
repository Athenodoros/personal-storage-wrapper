/**
 * @vitest-environment jsdom
 */

import { expect, test, vi } from "vitest";
import { MemoryTarget, MemoryTargetType } from "../../targets/memory";
import { ListBuffer } from "../../utilities/listbuffer";
import { PSMBroadcastChannel } from "./channel";
import { delay, getTestSync } from "./test";

const DELAY = 10;

test("Correctly updates values", async () => {
    const { value: valueA, syncs: syncsA, channel: channelA } = getTestChannel(0);
    const { value: valueB, syncs: syncsB, channel: channelB } = getTestChannel(0);

    const timestamp = new Date();
    channelA.sendNewValue({ value: "TEST", timestamp });

    await delay(DELAY);

    expect(valueA).not.toHaveBeenCalled();
    expect(syncsA).not.toHaveBeenCalled();
    expect(valueB).toHaveBeenCalledOnce();
    expect(valueB).toHaveBeenCalledWith({ value: "TEST", timestamp });
    expect(syncsB).not.toHaveBeenCalled();
    expect(channelB.recents.values()).toEqual(["TEST"]);

    await delay(DELAY * 3);

    expect(channelB.recents.values()).toEqual([]);
});

test("Correctly updates syncs", async () => {
    const { value: valueA, syncs: syncsA, channel: channelA } = getTestChannel(1);
    const { value: valueB, syncs: syncsB, channel: channelB } = getTestChannel(1);

    channelA.sendUpdatedSyncs([]);

    await delay(DELAY);

    expect(valueA).not.toHaveBeenCalled();
    expect(syncsA).not.toHaveBeenCalled();
    expect(valueB).not.toHaveBeenCalled();
    expect(syncsB).toHaveBeenCalledOnce();
    expect(syncsB).toHaveBeenCalledWith([]);
    expect(channelB.recents.values()).toEqual([]);
});

test("Does not trigger on own updates", async () => {
    const { syncs: syncsA, channel } = getTestChannel(2);
    const { syncs: syncsB } = getTestChannel(2);
    channel.sendUpdatedSyncs([await getTestSync()]);

    await delay(DELAY);

    expect(syncsA).not.toHaveBeenCalled();
    expect(syncsB).toHaveBeenCalledOnce();
});

test("Does not post values with no other channel open", async () => {
    const post = vi.spyOn(BroadcastChannel.prototype, "postMessage");
    const { channel } = getTestChannel(3);
    await delay(DELAY);

    await channel.sendNewValue({ value: "ALONE", timestamp: new Date() });
    expect(post).not.toHaveBeenCalled();

    post.mockRestore();
    channel.close();
});

test("Sends every value, rather than the latest, once another channel is open", async () => {
    const { channel: channelA } = getTestChannel(4);
    const { value: valueB, channel: channelB } = getTestChannel(4);
    await delay(DELAY);

    channelA.sendNewValue({ value: "FIRST", timestamp: new Date() });
    channelA.sendNewValue({ value: "SECOND", timestamp: new Date() });
    await delay(DELAY);

    expect(valueB).toHaveBeenCalledTimes(2);
    expect(channelB.recents.values()).toEqual(["SECOND", "FIRST"]);

    channelA.close();
    channelB.close();
});

test("Stops posting values once the other channel closes", async () => {
    const { channel: channelA } = getTestChannel(5);
    const { channel: channelB } = getTestChannel(5);
    await delay(DELAY);

    channelB.close();
    await delay(DELAY);

    const post = vi.spyOn(BroadcastChannel.prototype, "postMessage");
    await channelA.sendNewValue({ value: "ALONE", timestamp: new Date() });
    expect(post).not.toHaveBeenCalled();

    post.mockRestore();
    channelA.close();
});

test("Does not post a value sent just before closing", async () => {
    const { channel: channelA } = getTestChannel(6);
    const { value: valueB, channel: channelB } = getTestChannel(6);
    await delay(DELAY);

    // Posting to a closed BroadcastChannel throws, so this would reject if it went ahead
    const sent = channelA.sendNewValue({ value: "LATE", timestamp: new Date() });
    channelA.close();
    await sent;
    await delay(DELAY);

    expect(valueB).not.toHaveBeenCalled();
    channelB.close();
});

test("Always posts values without the Web Locks API", async () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, "navigator")!;
    Object.defineProperty(globalThis, "navigator", { value: {}, configurable: true });

    const post = vi.spyOn(BroadcastChannel.prototype, "postMessage");
    const { channel } = getTestChannel(7);

    await channel.sendNewValue({ value: "ALONE", timestamp: new Date() });
    expect(post).toHaveBeenCalledOnce();

    post.mockRestore();
    channel.close();
    Object.defineProperty(globalThis, "navigator", descriptor);
});

const getTestChannel = (id: any) => {
    const value = vi.fn();
    const syncs = vi.fn();
    const channel = new PSMBroadcastChannel(
        id + "-psm",
        new ListBuffer<string>([], { maxMillis: DELAY * 2 }),
        { [MemoryTargetType]: MemoryTarget.deserialise },
        value,
        syncs
    );

    return { value, syncs, channel };
};
