import { expect, test } from "vitest";
import { getTestSync } from "../utilities/test";
import { getTestOperationConfig } from "./test";
import { UpdateOperationRunner } from "./update";

test("Correctly updates to only most recent operation", async () => {
    const updateA = [await getTestSync(), await getTestSync()];
    const updateB = [await getTestSync(), await getTestSync()];

    const output = await UpdateOperationRunner(getTestOperationConfig({ args: [updateA, updateA, updateB] }));
    expect(output).toEqual({ syncs: updateB, skipChannel: true });
});
