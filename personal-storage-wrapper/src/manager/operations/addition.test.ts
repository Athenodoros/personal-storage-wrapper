import { expect, test } from "vitest";
import { getTestSync } from "../utilities/test";
import { AdditionOperationRunner } from "./addition";
import { getTestOperationConfig } from "./test";

test("Handles duplicate and redundant additions and writes to empty remotes", async () => {
    const syncA = await getTestSync();
    const syncB = await getTestSync();
    const syncC = await getTestSync();
    const syncD = { ...syncA };

    const output = await AdditionOperationRunner(
        getTestOperationConfig({ syncs: [syncA, syncB], args: [syncC, syncC, syncD] })
    );
    expect(output).toEqual({ syncs: [syncA, syncB, syncC], update: undefined, writes: [syncC] });
});

test("Calls conflict handler and writes locally", async () => {
    const syncA = await getTestSync({ value: { val: "VALUE1" } });
    const syncB = await getTestSync({ value: { val: "VALUE2" } });

    const output = await AdditionOperationRunner(
        getTestOperationConfig({
            syncs: [syncA],
            args: [syncB],
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
            args: [syncB],
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
            args: [syncB],
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
            args: [syncB],
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

test("Handles failed network with remote sync", async () => {
    const syncA = await getTestSync();
    const syncB = await getTestSync({ fails: true });

    const output = await AdditionOperationRunner(getTestOperationConfig({ syncs: [syncA], args: [syncB] }));

    expect(output).toEqual({ syncs: [syncA, syncB], update: undefined, writes: [] });
    expect(syncB.desynced).toBe(true);
});
