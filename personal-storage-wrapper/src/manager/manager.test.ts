/**
 * @vitest-environment jsdom
 */

import { expect, test, vi } from "vitest";
import { DefaultTargetsType } from "../main";
import { noop } from "../utilities/data";
import { PersonalStorageManager } from "./manager";
import { PSMCreationConfig, SyncFromTargets, Value } from "./types";
import { readFromSync } from "./utilities/requests";
import { delay, getTestSync } from "./utilities/test";

const DELAY = 10;

test("Can create a PSM correctly", async () => {
    const onSyncStatesUpdate = vi.fn();
    const manager = await getTestManager("VALUE", [], { onSyncStatesUpdate });
    expect(manager.getValue()).toBe("VALUE");
    expect(onSyncStatesUpdate).toHaveBeenCalledOnce();
});

/**
 * Startup Behaviour
 */

test("Handles conflicting results correctly on startup", async () => {
    const start = new Date().valueOf();

    const syncA = await getTestSync({ value: "A" });
    const syncB = await getTestSync({ value: "B", delay: DELAY });
    const manager = await getTestManager("VALUE", [syncA, syncB], {
        resolveConflictingSyncValuesOnStartup: async () => "B",
    });

    expect(new Date().valueOf() - start).toBeLessThan(DELAY * 0.5);
    expect(manager.getValue()).toBe("A");
    await delay(DELAY * 1.5);
    expect(manager.getValue()).toBe("B");

    expect((await readFromSync(() => noop, syncA)).value?.value).toBe("B");
});

test("Handles operations during startup and returns promise to actioned result", async () => {
    const syncA = await getTestSync({ value: "A" });
    const syncB = await getTestSync({ value: "B", delay: DELAY });
    const manager = await getTestManager("C", [syncA, syncB], {
        resolveConflictingSyncValuesOnStartup: async () => "D",
    });

    const promise = manager.removeSync(syncB);
    expect(manager.getValue()).toBe("A");
    await promise;
    expect(manager.getValue()).toBe("D");
    expect(manager.getSyncsState()).toEqual([syncA]);

    expect((await readFromSync(() => noop, syncA)).value?.value).toBe("D");
    expect((await readFromSync(() => noop, syncB)).value?.value).toBe("D");
});

/**
 * Basic Operations
 */

// Updates state immediately in callback, pushes async, and broadcasts to channel
// Successfully adds a sync and pushes to channel
// Successfully removes a sync and pushes to channel
// Successfully updates syncs from channel
// Successfully updates values from channel
// Successfully polls on manual trigger
// Polls for changes on schedule and updates to remote values
// Successfully writes to synced syncs

/**
 * Compound Tests
 */

// Calls onSyncsUpdate once with multiple changes (eg. add sync and desync another one)
// Correctly recovers from desyncs by calling handler
// Correctly recovers from descyncs without calling handler
// Correctly logs during read/write cycle
// Correctly handles new value during operation, then queued addition/removal operations

/**
 * Utilities
 */

let id = 0;
const getTestManager = async <V extends Value>(
    value: V,
    syncs: SyncFromTargets<DefaultTargetsType>[],
    config?: Partial<PSMCreationConfig<V, DefaultTargetsType>>
) =>
    PersonalStorageManager.create(value, {
        defaultSyncStates: Promise.resolve(syncs),
        getSyncData: () => null,
        saveSyncData: noop,
        id: "" + id++,
        pollPeriodInSeconds: null,
        ...config,
    });
