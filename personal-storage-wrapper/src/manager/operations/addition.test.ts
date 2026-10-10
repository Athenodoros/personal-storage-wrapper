import { expect, test, vi } from "vitest";
import { getTestSync } from "../utilities/test";
import { AdditionOperationRunner } from "./addition";
import { getTestOperationConfig } from "./test";

test("Handles duplicate and redundant additions and writes to empty remotes", async () => {
    const syncA = await getTestSync();
    const syncB = await getTestSync();
    const syncC = await getTestSync();
    const syncD = { ...syncA };

    const output = await AdditionOperationRunner(
        getTestOperationConfig({ syncs: [syncA, syncB], args: [{ sync: syncC }, { sync: syncC }, { sync: syncD }] })
    );
    expect(output).toEqual({ syncs: [syncA, syncB, syncC], update: undefined, writes: [syncC] });
});

test("Calls conflict handler and writes locally", async () => {
    const syncA = await getTestSync({ value: { val: "VALUE1" } });
    const syncB = await getTestSync({ value: { val: "VALUE2" } });

    const output = await AdditionOperationRunner(
        getTestOperationConfig({
            syncs: [syncA],
            args: [{ sync: syncB }],
            value: { val: "VALUE1" },
            config: { resolveConflictingSyncsUpdate: async () => ({ val: "VALUE2" }) },
        })
    );

    expect(output).toEqual({
        syncs: [syncA, syncB],
        update: { value: { val: "VALUE2" }, origin: "CONFLICT" },
        writes: [syncA],
    });
});

test("Calls conflict handler and writes remotely", async () => {
    const syncA = await getTestSync({ value: { val: "VALUE1" } });
    const syncB = await getTestSync({ value: { val: "VALUE2" } });

    const output = await AdditionOperationRunner(
        getTestOperationConfig({
            syncs: [syncA],
            args: [{ sync: syncB }],
            value: { val: "VALUE1" },
            config: { resolveConflictingSyncsUpdate: async () => ({ val: "VALUE1" }) },
        })
    );

    expect(output).toEqual({
        syncs: [syncA, syncB],
        update: undefined,
        writes: [syncB],
    });
});

test("Calls conflict handler and writes everywhere", async () => {
    const syncA = await getTestSync({ value: { val: "VALUE1" } });
    const syncB = await getTestSync({ value: { val: "VALUE2" } });

    const output = await AdditionOperationRunner(
        getTestOperationConfig({
            syncs: [syncA],
            args: [{ sync: syncB }],
            value: { val: "VALUE1" },
            config: { resolveConflictingSyncsUpdate: async () => ({ val: "VALUE3" }) },
        })
    );

    expect(output).toEqual({
        syncs: [syncA, syncB],
        update: { value: { val: "VALUE3" }, origin: "CONFLICT" },
        writes: [syncA, syncB],
    });
});

test("Does nothing with consistent state in remote sync", async () => {
    const syncA = await getTestSync({ value: { val: "VALUE1" } });
    const syncB = await getTestSync({ value: { val: "VALUE1" } });

    const output = await AdditionOperationRunner(
        getTestOperationConfig({
            syncs: [syncA],
            args: [{ sync: syncB }],
            value: { val: "VALUE1" },
            config: { resolveConflictingSyncsUpdate: async () => ({ val: "VALUE2" }) },
        })
    );

    expect(output).toEqual({
        syncs: [syncA, syncB],
        update: undefined,
        writes: [],
    });
});

test("Writes over the value it was told to replace without asking, and asks about any other", async () => {
    const syncA = await getTestSync({ value: { val: "VALUE1" } });
    const syncB = await getTestSync({ value: { val: "VALUE2" }, timestamp: 1000 });
    const resolveConflictingSyncsUpdate = vi.fn(async () => ({ val: "VALUE1" }));

    const replaced = await AdditionOperationRunner(
        getTestOperationConfig({
            syncs: [syncA],
            args: [{ sync: syncB, replacing: { val: "VALUE2" } }],
            value: { val: "VALUE1" },
            config: { resolveConflictingSyncsUpdate },
        })
    );

    expect(replaced).toEqual({ syncs: [syncA, syncB], update: undefined, writes: [syncB] });
    expect(resolveConflictingSyncsUpdate).not.toHaveBeenCalled();
    // Should the write fail, nothing else has written to the target since: the rules can tell
    expect(syncB.lastProcessedWriteTime).toEqual(new Date(1000));

    const syncC = await getTestSync({ value: { val: "VALUE3" } });
    await AdditionOperationRunner(
        getTestOperationConfig({
            syncs: [syncA],
            args: [{ sync: syncC, replacing: { val: "VALUE2" } }],
            value: { val: "VALUE1" },
            config: { resolveConflictingSyncsUpdate },
        })
    );
    expect(resolveConflictingSyncsUpdate).toHaveBeenCalledOnce();
});

test("Handles failed network with remote sync", async () => {
    const syncA = await getTestSync();
    const syncB = await getTestSync({ fails: true });

    const output = await AdditionOperationRunner(getTestOperationConfig({ syncs: [syncA], args: [{ sync: syncB }] }));

    expect(output).toEqual({ syncs: [syncA, syncB], update: undefined, writes: [] });
    expect(syncB.status).toEqual({ type: "BEHIND", cause: "OFFLINE" });
});
