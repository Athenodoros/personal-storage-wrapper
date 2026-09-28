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

test("Takes the syncs another context sent, keeping which targets this one found unreadable", async () => {
    const unreadable = await getTestSync();
    unreadable.unreadable = true;
    const other = await getTestSync();

    // Another context's copies of the same targets, which know nothing of what this one found
    const sent = [{ ...unreadable, unreadable: undefined }, { ...other }];

    const output = await UpdateOperationRunner(getTestOperationConfig({ args: [sent], syncs: [unreadable, other] }));

    expect(output.syncs).toEqual([{ ...unreadable, unreadable: true }, other]);
    expect(output.skipChannel).toBe(true);
});
