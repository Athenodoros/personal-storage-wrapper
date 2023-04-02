import { expect, test } from "vitest";
import { getTestSync } from "../utilities/test";
import { RemovalOperationRunner } from "./removal";
import { getTestOperationConfig } from "./test";

test("Handles duplicate removals", async () => {
    const syncA = await getTestSync();
    const syncB = await getTestSync();
    const syncC = await getTestSync();

    const output = await RemovalOperationRunner(
        getTestOperationConfig({ syncs: [syncA, syncB, syncC], args: [syncB, syncB] })
    );
    expect(output).toEqual({ syncs: [syncA, syncC] });
});
