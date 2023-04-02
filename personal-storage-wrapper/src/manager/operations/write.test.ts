import { expect, test } from "vitest";
import { getTestSync } from "../utilities/test";
import { getTestOperationConfig } from "./test";
import { WriteOperationRunner } from "./write";

test("Does not write to descyned syncs", async () => {
    const syncA = await getTestSync();
    const syncB = await getTestSync();
    const syncC = await getTestSync();
    syncB.desynced = true;

    const output = await WriteOperationRunner(getTestOperationConfig({ syncs: [syncA, syncB, syncC] }));
    expect(output).toEqual({ writes: [syncA, syncC] });
});
