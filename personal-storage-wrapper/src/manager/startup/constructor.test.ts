import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { MemoryTarget } from "../../targets/memory";
import { noop } from "../../utilities/data";
import { ConflictingSyncStartupBehaviour, InitialValue, OfflineSyncStartupHandler, Sync } from "../types";
import {
    DefaultTarget,
    resetToDefaultsOnOfflineTargets,
    resolveStartupConflictsWithRemoteStateAndLatestEdit,
} from "../utilities/defaults";
import { DELAY, expectToSettleAfter, getTestSync, settle } from "../utilities/test";
import { getPSMStartValue } from "./constructor";

beforeEach(() => void vi.useFakeTimers());
afterEach(() => void vi.useRealTimers());

test("Returns first valid value quickly if there is one", async () => {
    const storeA = await getTestSync({ timestamp: 0, value: "A", fails: true });
    const storeB = await getTestSync({ delay: DELAY, value: "B" });
    const storeC = await getTestSync({ delay: DELAY * 2, value: "C" });

    const value = await expectToSettleAfter(getPSMValue([storeA, storeB, storeC]), DELAY);
    expect(value).toMatchObject({ type: "provisional", value: "B" });
});

test("Returns last value provisionally if relevant", async () => {
    const storeA = await getTestSync({ delay: 0, value: "A", fails: true });
    const storeB = await getTestSync({ delay: DELAY, value: "B" });

    const value = await expectToSettleAfter(getPSMValue([storeA, storeB]), DELAY);
    expect(value).toMatchObject({ type: "provisional", value: "B" });
});

test("Uses callback in case of offline sources", async () => {
    const storeA = await getTestSync({ delay: 0, value: "A", fails: true });
    const storeB = await getTestSync({ delay: DELAY });

    const value = await expectToSettleAfter(
        getPSMValue([storeA, storeB], undefined, () => Promise.resolve({ behaviour: "VALUE", value: "PROMISE" })),
        DELAY
    );
    expect(value).toMatchObject({ type: "final", value: "PROMISE" });
});

test("Respects callback deferral to value in case of offline sources", async () => {
    const storeA = await getTestSync({ delay: 0, value: "A", fails: true });
    const storeB = await getTestSync({ delay: DELAY });

    const promise = getPSMValue([storeA, storeB], undefined, () =>
        Promise.resolve({ behaviour: "VALUE", value: "FALLBACK" })
    );
    const value = await expectToSettleAfter(promise, DELAY);
    expect(value).toMatchObject({ type: "final", value: "FALLBACK" });
});

test("Uses default value if required", async () => {
    const storeA = await getTestSync();
    const value = await settle(getPSMValue([storeA], () => Promise.resolve("PROMISE")));
    expect(value).toMatchObject({ type: "final", value: "PROMISE" });
});

/**
 * Utilities
 */
const getPSMValue = (
    stores: Sync<MemoryTarget>[],
    initialValue: InitialValue<string> = "DEFAULT",
    handleFullyOfflineSyncsOnStartup: OfflineSyncStartupHandler<
        string,
        DefaultTarget
    > = resetToDefaultsOnOfflineTargets,
    resolveConflictingSyncValuesOnStartup: ConflictingSyncStartupBehaviour<
        string,
        DefaultTarget
    > = resolveStartupConflictsWithRemoteStateAndLatestEdit
) =>
    getPSMStartValue<string, DefaultTarget>(
        stores,
        initialValue,
        () => ({
            handleAllEmptyAndFailedSyncsOnStartup: handleFullyOfflineSyncsOnStartup,
            resolveConflictingSyncValuesOnStartup,
        }),
        () => noop
    );
