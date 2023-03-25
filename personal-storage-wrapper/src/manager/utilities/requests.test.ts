import { expect, test, vi } from "vitest";
import { MemoryTarget, MemoryTargetType } from "../../targets/memory";
import { MemoryTargetSerialisationConfig } from "../../targets/memory/types";
import { Result } from "../../targets/result";
import { Sync } from "../types";
import { runWithLogger } from "./requests";

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
    const { logger, sync } = await runRequestTest(false, () => Result.error());

    expect(logger).toHaveBeenCalledTimes(2);
    expect(logger).toHaveBeenCalledWith({ sync, operation: "POLL", stage: "START" });
    expect(logger).toHaveBeenCalledWith({ sync, operation: "POLL", stage: "ERROR" });
});

const runRequestTest = async (
    fails: boolean,
    runner: (sync: Sync<MemoryTargetType, MemoryTargetSerialisationConfig>) => Result<any>
) => {
    const logger = vi.fn();
    const target = new MemoryTarget({ fails });
    const sync = { target, compressed: false };

    await runWithLogger(
        () => logger,
        sync,
        "POLL",
        () => runner(sync)
    );

    return { logger, sync };
};
