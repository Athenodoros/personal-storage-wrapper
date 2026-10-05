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
test("Revives the last processed write time of a stored sync as a date", async () => {
    const lastProcessedWriteTime = new Date(1000);
    const storage = getConfigFromSyncs([{ target: new MemoryTarget(), compressed: true, lastProcessedWriteTime }]);

    const [sync] = await getSyncsFromConfig(storage, DefaultDeserialisers);

    expect(sync.lastProcessedWriteTime).toBeInstanceOf(Date);
    expect(sync.lastProcessedWriteTime!.valueOf()).toBe(lastProcessedWriteTime.valueOf());
});

test("Leaves a sync that has never been written to without a last processed write time", async () => {
    const storage = getConfigFromSyncs([{ target: new MemoryTarget(), compressed: true }]);

    const [sync] = await getSyncsFromConfig(storage, DefaultDeserialisers);

    expect(sync.lastProcessedWriteTime).toBeUndefined();
});

/**
 * It is what tells a later startup that this target fell behind the others. The `desynced` that older
 * versions saved meant something looser, so it is dropped rather than read as a missed write.
 */
test("Remembers that a stored sync missed a write, but not an older version's desynced", async () => {
    const [missed] = await getSyncsFromConfig(
        getConfigFromSyncs([{ target: new MemoryTarget(), compressed: true, missedWrite: true }]),
        DefaultDeserialisers
    );
    const [desynced] = await getSyncsFromConfig(
        JSON.stringify([
            {
                type: "memory",
                config: JSON.stringify({ target: new MemoryTarget().serialise(), compressed: true, desynced: true }),
            },
        ]),
        DefaultDeserialisers
    );

    expect(missed.missedWrite).toBe(true);
    expect(desynced).not.toHaveProperty("desynced");
    expect(desynced.missedWrite).toBeUndefined();
});

/** Saved by an older version, which knew it as `lastSeenWriteTime`: losing it would lose the sync's history */
test("Takes on the last processed write time an older version saved under its earlier name", async () => {
    const storage = JSON.stringify([
        {
            type: "memory",
            config: JSON.stringify({
                target: new MemoryTarget().serialise(),
                compressed: true,
                lastSeenWriteTime: 1000,
            }),
        },
    ]);

    const [sync] = await getSyncsFromConfig(storage, DefaultDeserialisers);

    expect(sync.lastProcessedWriteTime).toEqual(new Date(1000));
    expect(sync).not.toHaveProperty("lastSeenWriteTime");
});
