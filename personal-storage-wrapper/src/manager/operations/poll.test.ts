import { expect, test, vi } from "vitest";
import { Result } from "../../targets/result";
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

/**
 * Real targets build a fresh Date on every call rather than handing back the one they were given,
 * and a lastSeenWriteTime read back out of storage is a string until it is revived. Comparing those
 * by identity meant a poll never recognised its own last write, and so downloaded the whole value
 * from every target on every tick.
 */
test("Recognises an unchanged remote whose timestamp is a new object each time", async () => {
    const written = new Date(1000);

    const sync = await getTestSync({ value: "VALUE1", timestamp: written });
    sync.lastSeenWriteTime = new Date(written.valueOf());
    sync.target.timestamp = () => Result.value<Date | null>(new Date(written.valueOf()));
    const download = vi.spyOn(sync.target, "read");

    const output = await PollOperationRunner(getTestOperationConfig({ value: "VALUE1", syncs: [sync] }));

    expect(download).not.toHaveBeenCalled();
    expect(output).toEqual({ writes: [], update: undefined });
});

test("Still reads a remote whose timestamp has moved on", async () => {
    const sync = await getTestSync({ value: "VALUE1", timestamp: new Date(1000) });
    sync.lastSeenWriteTime = new Date(500);
    sync.target.write(encodeToArrayBuffer(JSON.stringify("VALUE2")));

    const output = await PollOperationRunner(getTestOperationConfig({ value: "VALUE1", syncs: [sync] }));

    expect(output).toEqual({ update: { value: "VALUE2", origin: "REMOTE" }, writes: [] });
});
