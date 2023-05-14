import { expect, test, vi } from "vitest";
import { Value } from "../types";
import { getBufferFromValue } from "../utilities/serialisation";
import { getTestSync } from "../utilities/test";
import { handleInitialSyncValuesAndGetResult } from "./resolver";

test("Does nothing if no conflict", async () => {
    const resolver = vi.fn();
    const logger = vi.fn();

    const result = await handleInitialSyncValuesAndGetResult(
        { val: "DEFAULT" },
        () => ({ val: "DEFAULT" }),
        [await getQuickStoreWithValue({ val: "DEFAULT" }), await getQuickStoreWithValue({ val: "DEFAULT" })],
        resolver,
        () => logger
    );

    expect(resolver).not.toHaveBeenCalled();
    expect(logger).not.toHaveBeenCalled();
    expect(result).toEqual({ val: "DEFAULT" });
});

test("Writes back to empty sync", async () => {
    const resolver = vi.fn();
    const logger = vi.fn();

    const sync = await getTestSync();

    const result = await handleInitialSyncValuesAndGetResult(
        { val: "DEFAULT" },
        () => ({ val: "DEFAULT" }),
        [await getQuickStoreWithValue({ val: "DEFAULT" }), { sync, result: { type: "value", value: null } }],
        resolver,
        () => logger
    );

    expect(resolver).not.toHaveBeenCalled();
    expect(logger).toHaveBeenCalledTimes(2);
    expect(logger).toHaveBeenCalledWith({ sync, operation: "UPLOAD", stage: "START" });
    expect(logger).toHaveBeenCalledWith({ sync, operation: "UPLOAD", stage: "SUCCESS" });
    expect(result).toEqual({ val: "DEFAULT" });
});

test("Calls conflict handler if there is a conflict and writes back to available syncs", async () => {
    const resolver = vi.fn().mockImplementation(() => ({ val: "UPDATE" }));
    const logger = vi.fn();

    const online = await getTestSync({ value: "DEFAULT" });
    const offline = await getTestSync({ value: "OFFLINE" });
    const update = await getQuickStoreWithValue({ val: "UPDATE" });

    const result = await handleInitialSyncValuesAndGetResult(
        { val: "DEFAULT" },
        () => ({ val: "UNUSED_DEFAULT2" }),
        [
            { sync: online, result: { type: "value", value: { timestamp: new Date(), value: { val: "DEFAULT" } } } },
            update,
            { sync: offline, result: { type: "error", error: "OFFLINE" } },
        ],
        resolver,
        () => logger
    );

    expect(resolver).toHaveBeenCalledOnce();
    expect(resolver).toHaveBeenCalledWith({ val: "DEFAULT" }, { val: "UNUSED_DEFAULT2" }, [
        { sync: online, value: { value: { val: "DEFAULT" }, timestamp: expect.any(Date) } },
        { sync: update.sync, value: update.result.value },
    ]);
    expect(logger).toHaveBeenCalledTimes(2);
    expect(logger).toHaveBeenCalledWith({ sync: online, operation: "UPLOAD", stage: "START" });
    expect(logger).toHaveBeenCalledWith({ sync: online, operation: "UPLOAD", stage: "SUCCESS" });
    expect(result).toEqual({ val: "UPDATE" });

    expect((await online.target.read()).value?.buffer).toEqual(
        await getBufferFromValue({ val: "UPDATE" }, online.compressed)
    );
    expect((await offline.target.read()).value?.buffer).toEqual(
        await getBufferFromValue({ val: "OFFLINE" }, offline.compressed)
    );
});

/**
 * Utilities
 */

const getQuickStoreWithValue = async <V extends Value>(value: V) => ({
    sync: await getTestSync({ value }),
    result: { type: "value" as const, value: { timestamp: new Date(), value } },
});
