/**
 * @vitest-environment jsdom
 */

import { expect, test, vi } from "vitest";
import { MemoryTarget } from "../../targets/memory";
import { Result } from "../../targets/result";
import { compress } from "../../utilities/buffers/compression";
import { encodeToArrayBuffer } from "../../utilities/buffers/encoding";
import { noop } from "../../utilities/data";
import { Sync } from "../types";
import { readFromSync, readValueFromTarget, runWithLogger, timestampFromSync, writeToAndUpdateSync } from "./requests";
import { getTestSync } from "./test";

/**
 * The point of the timing checks below is that a write is stamped with the time it happened, not
 * some other epoch. A tight bound on that made the compressed test fail whenever the machine was
 * busy enough for gzip to take ten milliseconds.
 */
const RECENT_ENOUGH_MILLIS = 1000;

test("Respects offline behaviour correctly", async () => {
    const { logger, sync } = await runRequestTest(true, () => Result.value("RESULT"));

    expect(logger).toHaveBeenCalledOnce();
    expect(logger).toHaveBeenCalledWith({ sync, operation: "POLL", stage: "OFFLINE" });
});

test("Correctly logs successes", async () => {
    const { logger, sync } = await runRequestTest(false, () => Result.value("RESULT"));

    expect(logger).toHaveBeenCalledTimes(2);
    expect(logger).toHaveBeenCalledWith({ sync, operation: "POLL", stage: "START" });
    expect(logger).toHaveBeenCalledWith({ sync, operation: "POLL", stage: "SUCCESS" });
});

test("Correctly logs failures", async () => {
    const { logger, sync } = await runRequestTest(false, () => Result.error("UNKNOWN"));

    expect(logger).toHaveBeenCalledTimes(2);
    expect(logger).toHaveBeenCalledWith({ sync, operation: "POLL", stage: "START" });
    expect(logger).toHaveBeenCalledWith({ sync, operation: "POLL", stage: "ERROR" });
});

test("Writes and reads uncompressed values correctly", async () => {
    const start = new Date();
    const sync = { target: new MemoryTarget(), compressed: false };

    await writeToAndUpdateSync(() => noop, sync, 1);

    // Test value written
    expect((await sync.target.read()).value?.buffer).toEqual(encodeToArrayBuffer(JSON.stringify(1)));

    // Test timing
    const timestamp = (await timestampFromSync(() => noop, sync)).value?.valueOf() ?? -1000;
    expect(timestamp - start.valueOf()).greaterThanOrEqual(0);
    expect(timestamp - start.valueOf()).lessThan(RECENT_ENOUGH_MILLIS);

    // Test reads
    expect((await readFromSync(() => noop, sync)).value?.value).toBe(1);
});

test("Writes and reads compressed values correctly", async () => {
    const start = new Date();
    const sync = { target: new MemoryTarget(), compressed: true };

    await writeToAndUpdateSync(() => noop, sync, 1);

    // Test value written
    expect((await sync.target.read()).value?.buffer).toEqual(await compress(JSON.stringify(1)));

    // Test timing
    const timestamp = (await timestampFromSync(() => noop, sync)).value?.valueOf() ?? -1000;
    expect(timestamp - start.valueOf()).greaterThanOrEqual(0);
    expect(timestamp - start.valueOf()).lessThan(RECENT_ENOUGH_MILLIS);

    // Test reads
    expect((await readFromSync(() => noop, sync)).value?.value).toBe(1);
});

test("Reads a target's value without syncing to it", async () => {
    const target = new MemoryTarget();
    expect((await readValueFromTarget(target)).value).toBe(null);

    await writeToAndUpdateSync(() => noop, { target, compressed: true }, { some: "value" });

    const read = await readValueFromTarget<{ some: string }, MemoryTarget>(target);
    expect(read.value?.value).toEqual({ some: "value" });
});

test("Reports a target holding something it cannot decode, rather than never returning", async () => {
    const target = new MemoryTarget();
    await writeToAndUpdateSync(() => noop, { target, compressed: false }, "not compressed");

    // Read as though it were compressed, so decoding it throws
    const result = await readValueFromTarget(target, true);
    expect(result.type).toBe("error");
    expect(result.error).toBe("UNKNOWN");

    // What went wrong is carried rather than swallowed, so a caller can say more than "unknown"
    expect(result.detail).toBeTruthy();
});

const runRequestTest = async (fails: boolean, runner: (sync: Sync<MemoryTarget>) => Result<any>) => {
    const logger = vi.fn();
    const sync = await getTestSync({ fails });

    await runWithLogger(
        () => logger,
        sync,
        "POLL",
        () => runner(sync)
    );

    return { logger, sync };
};
