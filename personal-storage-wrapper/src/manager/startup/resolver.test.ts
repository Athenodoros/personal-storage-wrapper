import { expect, test, vi } from "vitest";
import { MemoryTarget, MemoryTargetType } from "../../targets/memory";
import { MemoryTargetSerialisationConfig } from "../../targets/memory/types";
import { Sync, Value } from "../types";
import { getBufferFromValue } from "../utilities/serialisation";
import { handleInitialSyncValuesAndGetResult } from "./resolver";

test("Does nothing if no conflict", async () => {
    const resolver = vi.fn();
    const logger = vi.fn();

    const result = await handleInitialSyncValuesAndGetResult(
        { val: "DEFAULT" },
        [getQuickStoreWithValue({ val: "DEFAULT" }), getQuickStoreWithValue({ val: "DEFAULT" })],
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

    const sync = getQuickStore(null);

    const result = await handleInitialSyncValuesAndGetResult(
        { val: "DEFAULT" },
        [getQuickStoreWithValue({ val: "DEFAULT" }), { sync, result: { type: "value", value: null } }],
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

    const online = getQuickStore({ val: "DEFAULT" });
    const offline = getQuickStore({ val: "OFFLINE" });

    const result = await handleInitialSyncValuesAndGetResult(
        { val: "DEFAULT" },
        [
            { sync: online, result: { type: "value", value: { timestamp: new Date(), value: { val: "DEFAULT" } } } },
            getQuickStoreWithValue({ val: "UPDATE" }),
            { sync: offline, result: { type: "error" } },
        ],
        resolver,
        () => logger
    );

    expect(resolver).toHaveBeenCalledOnce();
    expect(logger).toHaveBeenCalledTimes(2);
    expect(logger).toHaveBeenCalledWith({ sync: online, operation: "UPLOAD", stage: "START" });
    expect(logger).toHaveBeenCalledWith({ sync: online, operation: "UPLOAD", stage: "SUCCESS" });
    expect(result).toEqual({ val: "UPDATE" });

    expect((await online.target.read()).value?.buffer).toEqual(getBufferFromValue({ val: "UPDATE" }));
    expect((await offline.target.read()).value?.buffer).toEqual(getBufferFromValue({ val: "OFFLINE" }));
});

/**
 * Utilities
 */

const getQuickStoreWithValue = <V extends Value>(value: V) => ({
    sync: getQuickStore(value),
    result: { type: "value" as const, value: { timestamp: new Date(), value } },
});

const getQuickStore = <V extends Value>(
    value: V | null = null,
    delay: number = 0,
    fails: boolean = false
): Sync<MemoryTargetType, MemoryTargetSerialisationConfig> => {
    const target = new MemoryTarget({
        delay,
        fails,
        value: value && { timestamp: new Date(), buffer: getBufferFromValue(value) },
    });
    return { target, compressed: false };
};
