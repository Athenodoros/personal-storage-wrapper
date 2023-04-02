import { expect, test } from "vitest";
import { MemoryTarget, MemoryTargetType } from "../../targets/memory";
import { MemoryTargetSerialisationConfig } from "../../targets/memory/types";
import { noop } from "../../utilities/data";
import { ConflictingSyncStartupBehaviour, InitialValue, OfflineSyncStartupHandler, Sync, Value } from "../types";
import {
    DefaultTargetsType,
    resetToDefaultsOnOfflineTargets,
    resolveStartupConflictsWithRemoteStateAndLatestEdit,
} from "../utilities/defaults";
import { getBufferFromValue } from "../utilities/serialisation";
import { getPSMStartValue } from "./constructor";

const DELAY = 20;

test("Returns first valid value quickly if there is one", async () => {
    const storeA = await getQuickStore(0, "A", true);
    const storeB = await getQuickStore(DELAY, "B");
    const storeC = await getQuickStore(DELAY * 2, "C");

    const start = new Date();
    const value = await getPSMValue([storeA, storeB, storeC]);
    expect(value).toMatchObject({ type: "provisional", value: "B" });
    expect(new Date().valueOf() - start.valueOf()).toBeGreaterThanOrEqual(DELAY * 0.5);
    expect(new Date().valueOf() - start.valueOf()).toBeLessThanOrEqual(DELAY * 1.5);
});

test("Returns last value provisionally if relevant", async () => {
    const storeA = await getQuickStore(0, "A", true);
    const storeB = await getQuickStore(DELAY, "B");

    const start = new Date();
    const value = await getPSMValue([storeA, storeB]);
    expect(value).toMatchObject({ type: "provisional", value: "B" });
    expect(new Date().valueOf() - start.valueOf()).toBeGreaterThanOrEqual(DELAY * 0.5);
    expect(new Date().valueOf() - start.valueOf()).toBeLessThanOrEqual(DELAY * 1.5);
});

test("Uses callback in case of offline sources", async () => {
    const storeA = await getQuickStore(0, "A", true);
    const storeB = await getQuickStore(DELAY);

    const start = new Date();
    const value = await getPSMValue([storeA, storeB], undefined, () =>
        Promise.resolve({ behaviour: "VALUE", value: "PROMISE" })
    );
    expect(value).toMatchObject({ type: "final", value: "PROMISE" });
    expect(new Date().valueOf() - start.valueOf()).toBeGreaterThanOrEqual(DELAY * 0.5);
    expect(new Date().valueOf() - start.valueOf()).toBeLessThanOrEqual(DELAY * 1.5);
});

test("Respects callback deferral to value in case of offline sources", async () => {
    const storeA = await getQuickStore(0, "A", true);
    const storeB = await getQuickStore(DELAY);

    const start = new Date();
    const value = await getPSMValue([storeA, storeB], undefined, () =>
        Promise.resolve({ behaviour: "VALUE", value: "FALLBACK" })
    );
    expect(value).toMatchObject({ type: "final", value: "FALLBACK" });
    expect(new Date().valueOf() - start.valueOf()).toBeGreaterThanOrEqual(DELAY * 0.5);
    expect(new Date().valueOf() - start.valueOf()).toBeLessThanOrEqual(DELAY * 1.5);
});

test("Uses default value if required", async () => {
    const storeA = await getQuickStore();
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

const getQuickStore = async <V extends Value>(
    delay: number = 0,
    value: V | null = null,
    fails: boolean = false
): Promise<Sync<MemoryTargetType, MemoryTargetSerialisationConfig>> => {
    const compressed = false;
    const target = new MemoryTarget({
        delay,
        fails,
        value: value && { timestamp: new Date(), buffer: await getBufferFromValue(value, compressed) },
    });
    return { target, compressed };
};
