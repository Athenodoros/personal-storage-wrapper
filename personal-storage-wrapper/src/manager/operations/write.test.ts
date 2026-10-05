import { expect, test } from "vitest";
import { getTestSync } from "../utilities/test";
import { getTestOperationConfig } from "./test";
import { WriteOperationRunner } from "./write";

test("Writes to a sync only if nothing else has written to it, and asks for a poll if something has", async () => {
    const empty = await getTestSync();

    // It holds what was last written to it from here, whether or not that write worked
    const inStep = await getTestSync({ value: "A", timestamp: 1000 });
    inStep.lastProcessedWriteTime = new Date(1000);
    const untouched = await getTestSync({ value: "A", timestamp: 1000 });
    untouched.lastProcessedWriteTime = new Date(1000);
    untouched.missedWrite = true;

    // Something else has written to it since, whether or not this manager's last write to it worked
    const movedOn = await getTestSync({ value: "OTHER", timestamp: 2000 });
    movedOn.lastProcessedWriteTime = new Date(1000);
    const movedOnAfterMissing = await getTestSync({ value: "OTHER", timestamp: 2000 });
    movedOnAfterMissing.lastProcessedWriteTime = new Date(1000);
    movedOnAfterMissing.missedWrite = true;

    const syncs = [empty, inStep, untouched, movedOn, movedOnAfterMissing];
    const output = await WriteOperationRunner(getTestOperationConfig({ syncs, args: ["ALL"] }));
    expect(output).toEqual({ writes: [empty, inStep, untouched], poll: true });

    // The value isn't there, which the poll and any later startup need to know
    expect(movedOn.missedWrite).toBe(true);
    expect(movedOnAfterMissing.missedWrite).toBe(true);
});

test("Leaves a sync that can't be reached, without a poll, and records that it missed the write", async () => {
    const synced = await getTestSync();
    const unreachable = await getTestSync({ fails: true });

    const output = await WriteOperationRunner(getTestOperationConfig({ syncs: [synced, unreachable], args: ["ALL"] }));
    expect(output).toEqual({ writes: [synced] });
    expect(unreachable.missedWrite).toBe(true);
});

test("Writes to every sync that any of a batch of writes asked for", async () => {
    const full = await getTestSync({ value: "A", timestamp: 1000 });
    full.lastProcessedWriteTime = new Date(1000);
    const empty = await getTestSync();
    const other = await getTestSync({ value: "A", timestamp: 1000 });
    other.lastProcessedWriteTime = new Date(1000);
    const syncs = [full, empty, other];

    // A new value goes everywhere, even when it is batched with a write to one empty sync, either way round
    expect(await WriteOperationRunner(getTestOperationConfig({ syncs, args: ["ALL", [empty]] }))).toEqual({
        writes: syncs,
    });
    expect(await WriteOperationRunner(getTestOperationConfig({ syncs, args: [[empty], "ALL"] }))).toEqual({
        writes: syncs,
    });

    // Writes that each name syncs cover all of them, and nothing else
    expect(await WriteOperationRunner(getTestOperationConfig({ syncs, args: [[empty], [full]] }))).toEqual({
        writes: [full, empty],
    });
});

test("Doesn't check a sync holding a value that couldn't be read, since it is never written to", async () => {
    const unreadable = await getTestSync({ value: "A", timestamp: 2000 });
    unreadable.lastProcessedWriteTime = new Date(1000);
    unreadable.missedWrite = true;
    unreadable.unreadable = true;

    // Checking would find that it has moved on, and ask for a poll
    const output = await WriteOperationRunner(getTestOperationConfig({ syncs: [unreadable], args: ["ALL"] }));
    expect(output).toEqual({ writes: [unreadable] });
});
