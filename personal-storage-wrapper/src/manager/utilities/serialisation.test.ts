import { expect, test } from "vitest";
import { MemoryTarget } from "../../targets/memory";
import { DefaultDeserialisers } from "./defaults";
import { getBufferFromValue, getConfigFromSyncs, getSyncsFromConfig, getValueFromBuffer } from "./serialisation";

test("Correctly serialises and deserialises buffers", async () => {
    const test = { a: 1, b: [2, 3, 4, "asdfgh"] };
    const buffer = getBufferFromValue(test);
    const result = getValueFromBuffer(buffer);
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
