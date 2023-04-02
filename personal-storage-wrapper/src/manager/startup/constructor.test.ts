import { expect, test } from "vitest";
import { MemoryTargetType } from "../../targets/memory";
import { MemoryTargetSerialisationConfig } from "../../targets/memory/types";
import { noop } from "../../utilities/data";
import { ConflictingSyncStartupBehaviour, InitialValue, OfflineSyncStartupHandler, Sync } from "../types";
import {
    DefaultTargetsType,
    resetToDefaultsOnOfflineTargets,
    resolveStartupConflictsWithRemoteStateAndLatestEdit,
} from "../utilities/defaults";
import { getTestSync } from "../utilities/test";
import { getPSMStartValue } from "./constructor";

const DELAY = 20;

test("Returns first valid value quickly if there is one", async () => {
    const storeA = await getTestSync({ timestamp: 0, value: "A", fails: true });
    const storeB = await getTestSync({ delay: DELAY, value: "B" });
    const storeC = await getTestSync({ delay: DELAY * 2, value: "C" });

    const start = new Date();
    const value = await getPSMValue([storeA, storeB, storeC]);
    expect(value).toMatchObject({ type: "provisional", value: "B" });
    expect(new Date().valueOf() - start.valueOf()).toBeGreaterThanOrEqual(DELAY * 0.5);
    expect(new Date().valueOf() - start.valueOf()).toBeLessThanOrEqual(DELAY * 1.5);
});

test("Returns last value provisionally if relevant", async () => {
    const storeA = await getTestSync({ delay: 0, value: "A", fails: true });
    const storeB = await getTestSync({ delay: DELAY, value: "B" });

    const start = new Date();
    const value = await getPSMValue([storeA, storeB]);
    expect(value).toMatchObject({ type: "provisional", value: "B" });
    expect(new Date().valueOf() - start.valueOf()).toBeGreaterThanOrEqual(DELAY * 0.5);
    expect(new Date().valueOf() - start.valueOf()).toBeLessThanOrEqual(DELAY * 1.5);
});

test("Uses callback in case of offline sources", async () => {
    const storeA = await getTestSync({ delay: 0, value: "A", fails: true });
    const storeB = await getTestSync({ delay: DELAY });

    const start = new Date();
    const value = await getPSMValue([storeA, storeB], undefined, () =>
        Promise.resolve({ behaviour: "VALUE", value: "PROMISE" })
    );
    expect(value).toMatchObject({ type: "final", value: "PROMISE" });
    expect(new Date().valueOf() - start.valueOf()).toBeGreaterThanOrEqual(DELAY * 0.5);
    expect(new Date().valueOf() - start.valueOf()).toBeLessThanOrEqual(DELAY * 1.5);
});

test("Respects callback deferral to value in case of offline sources", async () => {
    const storeA = await getTestSync({ delay: 0, value: "A", fails: true });
    const storeB = await getTestSync({ delay: DELAY });

    const start = new Date();
    const value = await getPSMValue([storeA, storeB], undefined, () =>
        Promise.resolve({ behaviour: "VALUE", value: "FALLBACK" })
    );
    expect(value).toMatchObject({ type: "final", value: "FALLBACK" });
    expect(new Date().valueOf() - start.valueOf()).toBeGreaterThanOrEqual(DELAY * 0.5);
    expect(new Date().valueOf() - start.valueOf()).toBeLessThanOrEqual(DELAY * 1.5);
});

test("Uses default value if required", async () => {
    const storeA = await getTestSync();
    const value = await getPSMValue([storeA], () => Promise.resolve("PROMISE"));
    expect(value).toMatchObject({ type: "final", value: "PROMISE" });
});

/**
 * Utilities
 */
const getPSMValue = (
    stores: Sync<MemoryTargetType, MemoryTargetSerialisationConfig>[],
    initialValue: InitialValue<string> = "DEFAULT",
    handleFullyOfflineSyncsOnStartup: OfflineSyncStartupHandler<
        DefaultTargetsType,
        string
    > = resetToDefaultsOnOfflineTargets,
    resolveConflictingSyncValuesOnStartup: ConflictingSyncStartupBehaviour<
        DefaultTargetsType,
        string
    > = resolveStartupConflictsWithRemoteStateAndLatestEdit
) =>
    getPSMStartValue<string, DefaultTargetsType>(
        stores,
        initialValue,
        handleFullyOfflineSyncsOnStartup,
        resolveConflictingSyncValuesOnStartup,
        () => noop
    );
