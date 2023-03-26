/**
 * @vitest-environment jsdom
 */

import { expect, test, vi } from "vitest";
import { MemoryTarget, MemoryTargetType } from "../../targets/memory";
import { PSMBroadcastChannel } from "./channel";

test("Correctly updates values", async () => {
    const { value: valueA, syncs: syncsA, channel: channelA } = getTestChannel();
    const { value: valueB, syncs: syncsB, channel: channelB } = getTestChannel();

    channelA.sendNewValue("TEST");

    await delay();

    expect(valueA).not.toHaveBeenCalled();
    expect(syncsA).not.toHaveBeenCalled();
    expect(valueB).toHaveBeenCalledOnce();
    expect(valueB).toHaveBeenCalledWith("TEST");
    expect(syncsB).not.toHaveBeenCalled();
});

test("Correctly updates syncs", async () => {
    const { value: valueA, syncs: syncsA, channel: channelA } = getTestChannel();
    const { value: valueB, syncs: syncsB, channel: channelB } = getTestChannel();

    channelA.sendUpdatedSyncs([]);

    await delay();

    expect(valueA).not.toHaveBeenCalled();
    expect(syncsA).not.toHaveBeenCalled();
    expect(valueB).not.toHaveBeenCalled();
    expect(syncsB).toHaveBeenCalledOnce();
    expect(syncsB).toHaveBeenCalledWith([]);
});

const getTestChannel = () => {
    const value = vi.fn();
    const syncs = vi.fn();
    const channel = new PSMBroadcastChannel({ [MemoryTargetType]: MemoryTarget.deserialise }, value, syncs);

    return { value, syncs, channel };
};

const delay = () => new Promise((resolve) => setTimeout(() => resolve(null), 10));
