/**
 * @vitest-environment jsdom
 */

import { expect, test, vi } from "vitest";
import { DefaultDeserialisers, DefaultTargetsType } from "../main";
import { noop } from "../utilities/data";
import { ListBuffer } from "../utilities/listbuffer";
import { PersonalStorageManager } from "./manager";
import { PSMCreationConfig, SyncFromTargets } from "./types";
import { PSMBroadcastChannel } from "./utilities/channel";
import { readFromSync } from "./utilities/requests";
import { getConfigFromSyncs } from "./utilities/serialisation";
import { delay, getTestSync } from "./utilities/test";

const DELAY = 10;
const DEFAULT_VALUE = "DEFAULT_VALUE";

test("Can create a PSM correctly", async () => {
    const onSyncStatesUpdate = vi.fn();
    const manager = await getTestManager([], { onSyncStatesUpdate });
    expect(manager.getValue()).toBe(DEFAULT_VALUE);
    expect(onSyncStatesUpdate).toHaveBeenCalledOnce();
});

/**
 * Startup Behaviour
 */

test("Handles conflicting results correctly on startup", async () => {
    const start = new Date().valueOf();

    const syncA = await getTestSync({ value: "A" });
    const syncB = await getTestSync({ value: "B", delay: DELAY });
    const manager = await getTestManager([syncA, syncB], {
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
    const manager = await getTestManager([syncA, syncB], {
        resolveConflictingSyncValuesOnStartup: async () => "C",
    });

    const promise = manager.removeSync(syncB);
    expect(manager.getValue()).toBe("A");
    await promise;
    expect(manager.getValue()).toBe("C");
    expect(manager.getSyncsState()).toEqual([syncA]);

    expect((await readFromSync(() => noop, syncA)).value?.value).toBe("C");
    expect((await readFromSync(() => noop, syncB)).value?.value).toBe("C");
});

/**
 * Basic Operations
 */
test("Updates state and broadcasts to channel immediately in callback but pushes async", async () => {
    const id = "immediate-broadcast-test";
    const listener = vi.fn();
    new PSMBroadcastChannel(id, new ListBuffer<string>(), DefaultDeserialisers, listener, noop);
    expect(listener).not.toHaveBeenCalled();

    const syncA = await getTestSync({ value: "A" });
    const syncB = await getTestSync({ value: "A", delay: DELAY });
    const manager = await getTestManager([syncA, syncB], { id });
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
    const manager = await getTestManager([syncA, syncB], {
        resolveConflictingSyncValuesOnStartup: handler,
    });
    manager.setValueAndPushToSyncs("C");

    const valueA = (await readFromSync(() => noop, syncA)).value;
    const valueB = (await readFromSync(() => noop, syncB)).value;
    await delay(DELAY * 1.5);

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith("A", "C", [
        { sync: syncA, value: valueA },
        { sync: syncB, value: valueB },
    ]);
});

test("Successfully adds a sync and pushes to channel", async () => {
    const id = "add-sync-broadcast-test";
    const listener = vi.fn();
    new PSMBroadcastChannel(id, new ListBuffer<string>(), DefaultDeserialisers, noop, listener);
    expect(listener).not.toHaveBeenCalled();

    const syncA = await getTestSync({ value: "A" });
    const manager = await getTestManager([syncA], { id });
    expect(listener).not.toHaveBeenCalled();

    const syncB = await getTestSync({ value: "A" });
    await manager.addSync(syncB);
    expect(manager.getSyncsState()).toEqual([syncA, syncB]);

    await delay(DELAY);
    expect(listener).toHaveBeenCalledOnce();
    expect(getConfigFromSyncs(listener.mock.calls[0][0])).toEqual(getConfigFromSyncs([syncA, syncB]));
});

test("Successfully removes a sync and pushes to channel", async () => {
    const id = "remove-sync-broadcast-test";
    const listener = vi.fn();
    new PSMBroadcastChannel(id, new ListBuffer<string>(), DefaultDeserialisers, noop, listener);
    expect(listener).not.toHaveBeenCalled();

    const syncA = await getTestSync({ value: "A" });
    const syncB = await getTestSync({ value: "A" });
    const manager = await getTestManager([syncA, syncB], { id });
    expect(listener).not.toHaveBeenCalled();

    await manager.removeSync(syncB);
    expect(manager.getSyncsState()).toEqual([syncA]);

    await delay(DELAY);
    expect(listener).toHaveBeenCalledOnce();
    expect(getConfigFromSyncs(listener.mock.calls[0][0])).toEqual(getConfigFromSyncs([syncA]));
});

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
const getTestManager = async (
    syncs: SyncFromTargets<DefaultTargetsType>[],
    config?: Partial<PSMCreationConfig<string, DefaultTargetsType>>
) =>
    PersonalStorageManager.create(DEFAULT_VALUE, {
        defaultSyncStates: Promise.resolve(syncs),
        getSyncData: () => null,
        saveSyncData: noop,
        id: "" + id++,
        pollPeriodInSeconds: null,
        ...config,
    });
