import { expect, test } from "vitest";
import { getTestSync } from "../utilities/test";
import { getTestOperationConfig } from "./test";
import { WriteOperationRunner } from "./write";

test("Writes to a desynced sync only if nothing else has written to it, and asks for a poll if something has", async () => {
    const synced = await getTestSync({ value: "A" });

    // Its write failed, but it still holds what was last written to it from here
    const untouched = await getTestSync({ value: "A", timestamp: 1000 });
    untouched.lastSeenWriteTime = new Date(1000);
    untouched.desynced = true;

    // Its write failed, and something else has written to it since
    const movedOn = await getTestSync({ value: "OTHER", timestamp: 2000 });
    movedOn.lastSeenWriteTime = new Date(1000);
    movedOn.desynced = true;

    const syncs = [synced, untouched, movedOn];
    const output = await WriteOperationRunner(getTestOperationConfig({ syncs, args: ["ALL"] }));
    expect(output).toEqual({ writes: [synced, untouched], poll: true });
});

test("Leaves a desynced sync that can't be reached, without a poll", async () => {
    const synced = await getTestSync();
    const unreachable = await getTestSync({ fails: true });
    unreachable.desynced = true;

    const output = await WriteOperationRunner(getTestOperationConfig({ syncs: [synced, unreachable], args: ["ALL"] }));
    expect(output).toEqual({ writes: [synced] });
});

test("Writes to every sync that any of a batch of writes asked for", async () => {
    const full = await getTestSync({ value: "A" });
    const empty = await getTestSync();
    const other = await getTestSync({ value: "A" });
    const syncs = [full, empty, other];

    // A new value goes everywhere, even when it is batched with a write to one empty sync, either way round
    expect(await WriteOperationRunner(getTestOperationConfig({ syncs, args: ["ALL", [empty]] }))).toEqual({ writes: syncs });
    expect(await WriteOperationRunner(getTestOperationConfig({ syncs, args: [[empty], "ALL"] }))).toEqual({ writes: syncs });

    // Writes that each name syncs cover all of them, and nothing else
    expect(await WriteOperationRunner(getTestOperationConfig({ syncs, args: [[empty], [full]] }))).toEqual({
        writes: [full, empty],
    });
});
