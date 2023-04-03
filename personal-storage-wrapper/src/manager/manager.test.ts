/**
 * @vitest-environment jsdom
 */

import { expect, test, vi } from "vitest";
import { DefaultDeserialisers, DefaultTargetsType } from "../main";
import { noop } from "../utilities/data";
import { ListBuffer } from "../utilities/listbuffer";
import { PersonalStorageManager } from "./manager";
import { PSMCreationConfig, SyncFromTargets, Value } from "./types";
import { PSMBroadcastChannel } from "./utilities/channel";
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
test("Updates state and broadcasts to channel immediately in callback but pushes async", async () => {
    const id = "immediate-broadcast-test";
    const listener = vi.fn();
    new PSMBroadcastChannel(id + "-channel", new ListBuffer<string>(), DefaultDeserialisers, listener, noop);
    expect(listener).not.toHaveBeenCalled();

    const syncA = await getTestSync({ value: "A" });
    const syncB = await getTestSync({ value: "A", delay: DELAY });
    const manager = await getTestManager<string>("C", [syncA, syncB], { id });
    expect(listener).not.toHaveBeenCalled(); // Doesn't broadcast on first load

    manager.setValueAndPushToSyncs("B");
    expect(manager.getValue()).toBe("B");
    await delay(DELAY * 0.5);

    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith("B");
    expect((await readFromSync(() => noop, syncA)).value?.value).toBe("A");

    await delay(DELAY * 1);

    expect(listener).toHaveBeenCalledOnce(); // Doesn't clobber new value after remote read
    expect((await readFromSync(() => noop, syncA)).value?.value).toBe("B");
});

test("Provides newest value to startup conflict handler", async () => {
    const handler = vi.fn();
    handler.mockImplementation(async () => "A");

    const syncA = await getTestSync({ value: "A" });
    const syncB = await getTestSync({ value: "B", delay: DELAY });
    const manager = await getTestManager<string>("C", [syncA, syncB], {
        resolveConflictingSyncValuesOnStartup: handler,
    });
    manager.setValueAndPushToSyncs("D");

    const valueA = (await readFromSync(() => noop, syncA)).value;
    const valueB = (await readFromSync(() => noop, syncB)).value;
    await delay(DELAY * 1.5);

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith("A", "D", [
        { sync: syncA, value: valueA },
        { sync: syncB, value: valueB },
    ]);
});

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
