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

    await delay(DELAY * 2.5);

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
