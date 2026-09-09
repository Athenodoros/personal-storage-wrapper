/**
 * @vitest-environment jsdom
 */

import { expect, test } from "vitest";
import { MemoryTarget } from "../../targets/memory";
import { encodeTextToBuffer } from "../../utilities/buffers";
import { compress } from "../../utilities/buffers/compression";
import { DefaultDeserialisers } from "./defaults";
import { getBufferFromValue, getConfigFromSyncs, getSyncsFromConfig, getValueFromBuffer } from "./serialisation";

test("Correctly serialises and deserialises uncompressed buffers", async () => {
    const test = { a: 1, b: [2, 3, 4, "asdfgh"] };
    const buffer = await getBufferFromValue(test, false);
    expect(buffer).toEqual(await encodeTextToBuffer(JSON.stringify(test), false));

    const result = await getValueFromBuffer(buffer, false);
    expect(result).toEqual(test);
});

test("Correctly serialises and deserialises compressed buffers", async () => {
    const test = { a: 1, b: [2, 3, 4, "asdfgh"] };
    const buffer = await getBufferFromValue(test, true);
    expect(buffer).toEqual(await compress(JSON.stringify(test)));

    const result = await getValueFromBuffer(buffer, true);
    expect(result).toEqual(test);
});

test("Correctly serialises and deserialises the same syncs", async () => {
    const target = new MemoryTarget();
    const syncs = [{ target, compressed: true }];
    const storage = getConfigFromSyncs(syncs);
    const result = await getSyncsFromConfig(storage, DefaultDeserialisers);

    // Don't compare with `syncs` directly because instance members will fail equality check
    expect(result).toMatchObject([{ compressed: true, target: { type: "memory" } }]);
});

/**
 * The poll check that skips an unchanged remote compares this against a Date from the target, so a
 * sync restored from storage has to come back with a Date rather than the string JSON left behind.
 */
test("Revives the last seen write time of a stored sync as a date", async () => {
    const lastSeenWriteTime = new Date(1000);
    const storage = getConfigFromSyncs([{ target: new MemoryTarget(), compressed: true, lastSeenWriteTime }]);

    const [sync] = await getSyncsFromConfig(storage, DefaultDeserialisers);

    expect(sync.lastSeenWriteTime).toBeInstanceOf(Date);
    expect(sync.lastSeenWriteTime!.valueOf()).toBe(lastSeenWriteTime.valueOf());
});

test("Leaves a sync that has never been written to without a last seen write time", async () => {
    const storage = getConfigFromSyncs([{ target: new MemoryTarget(), compressed: true }]);

    const [sync] = await getSyncsFromConfig(storage, DefaultDeserialisers);

    expect(sync.lastSeenWriteTime).toBeUndefined();
});

/**
 * Otherwise one failed write would stop a store being saved for good: a desynced sync is never
 * written to again, and with polling off there is nothing left to clear the flag.
 */
test("Gives a stored sync another chance rather than restoring that it failed", async () => {
    const storage = getConfigFromSyncs([{ target: new MemoryTarget(), compressed: true, desynced: true }]);

    const [sync] = await getSyncsFromConfig(storage, DefaultDeserialisers);

    expect(sync.desynced).toBeUndefined();
});
