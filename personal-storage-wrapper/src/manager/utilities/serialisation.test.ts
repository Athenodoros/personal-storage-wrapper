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
