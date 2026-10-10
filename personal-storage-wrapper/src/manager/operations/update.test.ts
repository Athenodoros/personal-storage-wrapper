import { expect, test } from "vitest";
import { Sync, SyncStatus } from "../types";
import { getTestSync } from "../utilities/test";
import { getTestOperationConfig } from "./test";
import { UpdateOperationRunner } from "./update";

test("Correctly updates to only most recent operation", async () => {
    const updateA = [await getTestSync(), await getTestSync()];
    const updateB = [await getTestSync(), await getTestSync()];

    const output = await UpdateOperationRunner(getTestOperationConfig({ args: [updateA, updateA, updateB] }));
    expect(output).toEqual({ syncs: updateB, skipChannel: true });
});

test("Takes the syncs another context sent, keeping what this one found out about them itself", async () => {
    const unreadable = await getTestSync();
    unreadable.status = { type: "UNREADABLE" };
    const failing = await getTestSync();
    failing.status = { type: "BEHIND", cause: "FAILED" };
    const caughtUp = await getTestSync();
    caughtUp.status = { type: "BEHIND", cause: "FAILED" };

    // Another context's copies of the same targets, which only say whether each is behind
    const behind: SyncStatus = { type: "BEHIND", cause: "INHERITED" };
    const sent: Sync[] = [
        { ...unreadable, status: behind },
        { ...failing, status: behind },
        { ...caughtUp, status: { type: "IN_STEP" } },
    ];

    const output = await UpdateOperationRunner(
        getTestOperationConfig({ args: [sent], syncs: [unreadable, failing, caughtUp] })
    );

    expect(output.syncs?.map(({ status }) => status)).toEqual([
        { type: "UNREADABLE" },
        { type: "BEHIND", cause: "FAILED" },
        { type: "IN_STEP" },
    ]);
    expect(output.skipChannel).toBe(true);
});
