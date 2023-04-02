import { expect, test } from "vitest";
import { encodeToArrayBuffer } from "../../utilities/buffers/encoding";
import { getTestSync } from "../utilities/test";
import { PollOperationRunner } from "./poll";
import { getTestOperationConfig } from "./test";

test("Pulls updated value from remote", async () => {
    const syncA = await getTestSync({ value: "VALUE1" });
    const syncB = await getTestSync({ value: "VALUE1" });
    syncB.target.write(encodeToArrayBuffer(JSON.stringify("VALUE2")));

    const output = await PollOperationRunner(
        getTestOperationConfig({
            value: "VALUE1",
            syncs: [syncA, syncB],
        })
    );

    expect(output).toEqual({ update: { value: "VALUE2", origin: "REMOTE" }, writes: [syncA] });
});

test("Handles failed remotes", async () => {
    const syncA = await getTestSync({ value: "VALUE1", fails: true });
    const syncB = await getTestSync({ value: "VALUE1" });
    syncB.target.write(encodeToArrayBuffer(JSON.stringify("VALUE2")));

    const output = await PollOperationRunner(
        getTestOperationConfig({
            value: "VALUE1",
            syncs: [syncA, syncB],
        })
    );

    expect(output).toEqual({ update: { value: "VALUE2", origin: "REMOTE" }, writes: [] });
});

test("Handles conflicting remotes and writes selectively", async () => {
    const syncA = await getTestSync({ value: "VALUE1" });
    syncA.target.write(encodeToArrayBuffer(JSON.stringify("VALUEA")));
    const syncB = await getTestSync({ value: "VALUE1" });
    syncB.target.write(encodeToArrayBuffer(JSON.stringify("VALUEB")));
    const syncC = await getTestSync({ fails: true });

    const output = await PollOperationRunner(
        getTestOperationConfig({
            value: "VALUE1",
            syncs: [syncA, syncB, syncC],
            config: { resolveConflictingSyncsUpdate: async () => "VALUEA" },
        })
    );

    expect(output).toEqual({ update: { value: "VALUEA", origin: "CONFLICT" }, writes: [syncB] });
});

test("Handles conflicting remotes and writes everywhere", async () => {
    const syncA = await getTestSync({ value: "VALUE1" });
    syncA.target.write(encodeToArrayBuffer(JSON.stringify("VALUEA")));
    const syncB = await getTestSync({ value: "VALUE1" });
    syncB.target.write(encodeToArrayBuffer(JSON.stringify("VALUEB")));
    const syncC = await getTestSync({ fails: true });

    const output = await PollOperationRunner(
        getTestOperationConfig({
            value: "VALUE1",
            syncs: [syncA, syncB, syncC],
            config: { resolveConflictingSyncsUpdate: async () => "VALUEC" },
        })
    );

    expect(output).toEqual({ update: { value: "VALUEC", origin: "CONFLICT" }, writes: [syncA, syncB] });
});
