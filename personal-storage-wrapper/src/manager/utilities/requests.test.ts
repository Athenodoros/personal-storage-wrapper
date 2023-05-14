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
import { readFromSync, runWithLogger, timestampFromSync, writeToAndUpdateSync } from "./requests";
import { getTestSync } from "./test";

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
    expect(timestamp - start.valueOf()).lessThan(10);

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
    expect(timestamp - start.valueOf()).lessThan(10);

    // Test reads
    expect((await readFromSync(() => noop, sync)).value?.value).toBe(1);
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
