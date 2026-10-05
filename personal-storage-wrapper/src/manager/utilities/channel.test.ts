/**
 * Node's environment rather than jsdom's, for its `navigator.locks`, which tells a channel whether any
 * other is listening: jsdom's navigator has no Web Locks API
 *
 * @vitest-environment node
 */

import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { MemoryTarget, MemoryTargetType } from "../../targets/memory";
import { ListBuffer } from "../../utilities/listbuffer";
import { PSMBroadcastChannel } from "./channel";
import { DELAY, getTestSync } from "./test";

beforeEach(() => void vi.useFakeTimers());
afterEach(() => void vi.useRealTimers());

test("Correctly updates values", async () => {
    const { value: valueA, syncs: syncsA, channel: channelA } = getTestChannel(0);
    const { value: valueB, syncs: syncsB, channel: channelB } = getTestChannel(0);

    const timestamp = new Date();
    channelA.sendNewValue({ value: "TEST", timestamp });

    await vi.waitFor(() => expect(valueB).toHaveBeenCalledOnce());
    expect(valueA).not.toHaveBeenCalled();
    expect(syncsA).not.toHaveBeenCalled();
    expect(valueB).toHaveBeenCalledWith({ value: "TEST", timestamp });
    expect(syncsB).not.toHaveBeenCalled();
    expect(channelB.recents.values()).toEqual(["TEST"]);

    // Kept for at least `maxMillis`, and dropped by a timer that runs that often
    await vi.advanceTimersByTimeAsync(DELAY * 4);
    expect(channelB.recents.values()).toEqual([]);
});

test("Correctly updates syncs", async () => {
    const { value: valueA, syncs: syncsA, channel: channelA } = getTestChannel(1);
    const { value: valueB, syncs: syncsB, channel: channelB } = getTestChannel(1);

    channelA.sendUpdatedSyncs([]);

    await vi.waitFor(() => expect(syncsB).toHaveBeenCalledOnce());
    expect(valueA).not.toHaveBeenCalled();
    expect(syncsA).not.toHaveBeenCalled();
    expect(valueB).not.toHaveBeenCalled();
    expect(syncsB).toHaveBeenCalledWith([]);
    expect(channelB.recents.values()).toEqual([]);
});

test("Does not trigger on own updates", async () => {
    const { syncs: syncsA, channel } = getTestChannel(2);
    const { syncs: syncsB } = getTestChannel(2);
    channel.sendUpdatedSyncs([await getTestSync()]);

    // By the time the other channel has it, this one would have too
    await vi.waitFor(() => expect(syncsB).toHaveBeenCalledOnce());
    expect(syncsA).not.toHaveBeenCalled();
});

test("Does not post values with no other channel open", async () => {
    const post = vi.spyOn(BroadcastChannel.prototype, "postMessage");
    const { channel } = getTestChannel(3);

    await channel.sendNewValue({ value: "ALONE", timestamp: new Date() });
    expect(post).not.toHaveBeenCalled();

    post.mockRestore();
    channel.close();
});

test("Sends every value, rather than the latest, once another channel is open", async () => {
    const { channel: channelA } = getTestChannel(4);
    const { value: valueB, channel: channelB } = getTestChannel(4);
    await vi.waitFor(async () => expect(await countListening(4)).toBe(2));

    channelA.sendNewValue({ value: "FIRST", timestamp: new Date() });
    channelA.sendNewValue({ value: "SECOND", timestamp: new Date() });

    await vi.waitFor(() => expect(valueB).toHaveBeenCalledTimes(2));
    expect(channelB.recents.values()).toEqual(["SECOND", "FIRST"]);

    channelA.close();
    channelB.close();
});

test("Stops posting values once the other channel closes", async () => {
    const { channel: channelA } = getTestChannel(5);
    const { channel: channelB } = getTestChannel(5);
    await vi.waitFor(async () => expect(await countListening(5)).toBe(2));

    channelB.close();
    await vi.waitFor(async () => expect(await countListening(5)).toBe(1));

    const post = vi.spyOn(BroadcastChannel.prototype, "postMessage");
    await channelA.sendNewValue({ value: "ALONE", timestamp: new Date() });
    expect(post).not.toHaveBeenCalled();

    post.mockRestore();
    channelA.close();
});

test("Does not post a value sent just before closing", async () => {
    const { channel: channelA } = getTestChannel(6);
    const { channel: channelB } = getTestChannel(6);
    await vi.waitFor(async () => expect(await countListening(6)).toBe(2));

    // Posting to a closed BroadcastChannel throws, so this would reject if it went ahead
    const post = vi.spyOn(BroadcastChannel.prototype, "postMessage");
    const sent = channelA.sendNewValue({ value: "LATE", timestamp: new Date() });
    channelA.close();
    await sent;

    expect(post).not.toHaveBeenCalled();
    post.mockRestore();
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

/**
 * How many channels with this test id hold their lock, which each takes once it is listening: it is
 * how a channel knows whether another is there to send to
 */
const countListening = async (id: any) =>
    ((await navigator.locks.query()).held ?? []).filter(({ name }) =>
        name?.startsWith("personal-storage-wrapper:" + id + "-psm:")
    ).length;

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
