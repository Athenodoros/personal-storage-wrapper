/**
 * @vitest-environment jsdom
 */

import { expect, test, vi } from "vitest";
import { MemoryTarget, MemoryTargetType } from "../../targets/memory";
import { ListBuffer } from "../../utilities/listbuffer";
import { PSMBroadcastChannel } from "./channel";

const DELAY = 10;

test("Correctly updates values", async () => {
    const { value: valueA, syncs: syncsA, channel: channelA } = getTestChannel();
    const { value: valueB, syncs: syncsB, channel: channelB } = getTestChannel();

    channelA.sendNewValue("TEST");

    await delay(DELAY);

    expect(valueA).not.toHaveBeenCalled();
    expect(syncsA).not.toHaveBeenCalled();
    expect(valueB).toHaveBeenCalledOnce();
    expect(valueB).toHaveBeenCalledWith("TEST");
    expect(syncsB).not.toHaveBeenCalled();
    expect(channelB.recents.values()).toEqual(["TEST"]);

    await delay(DELAY * 1.5);

    expect(channelB.recents.values()).toEqual([]);
});

test("Correctly updates syncs", async () => {
    const { value: valueA, syncs: syncsA, channel: channelA } = getTestChannel();
    const { value: valueB, syncs: syncsB, channel: channelB } = getTestChannel();

    channelA.sendUpdatedSyncs([]);

    await delay(DELAY);

    expect(valueA).not.toHaveBeenCalled();
    expect(syncsA).not.toHaveBeenCalled();
    expect(valueB).not.toHaveBeenCalled();
    expect(syncsB).toHaveBeenCalledOnce();
    expect(syncsB).toHaveBeenCalledWith([]);
    expect(channelB.recents.values()).toEqual([]);
});

const getTestChannel = () => {
    const value = vi.fn();
    const syncs = vi.fn();
    const channel = new PSMBroadcastChannel(
        "psm",
        new ListBuffer<string>([], { maxMillis: DELAY * 2 }),
        { [MemoryTargetType]: MemoryTarget.deserialise },
        value,
        syncs
    );

    return { value, syncs, channel };
};

const delay = (duration: number) => new Promise((resolve) => setTimeout(() => resolve(null), duration));
