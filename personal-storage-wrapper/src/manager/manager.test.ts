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
import { readFromSync, writeToAndUpdateSync } from "./utilities/requests";
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

    manager.setValueAndAsyncPushToSyncs("B");
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
    manager.setValueAndAsyncPushToSyncs("C");

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

test("Successfully updates syncs from channel", async () => {
    const id = "update-sync-broadcast-test";

    const manager = await getTestManager([], { id });

    const channel = new PSMBroadcastChannel(id, new ListBuffer<string>(), DefaultDeserialisers, noop, noop);
    const syncA = await getTestSync({ value: "A" });
    channel.sendUpdatedSyncs([syncA]);
    await delay(DELAY);

    expect(getConfigFromSyncs(manager.getSyncsState())).toEqual(getConfigFromSyncs([syncA]));
});

test("Successfully updates values from channel", async () => {
    const id = "update-value-broadcast-test";
    const manager = await getTestManager([], { id });

    const channel = new PSMBroadcastChannel(id, new ListBuffer<string>(), DefaultDeserialisers, noop, noop);
    channel.sendNewValue("UPDATE");
    await delay(DELAY);

    expect(manager.getValue()).toEqual("UPDATE");
});

test("Successfully polls on manual trigger and writes to remotes", async () => {
    const syncA = await getTestSync({ value: "A" });
    const syncB = await getTestSync({ value: "A" });
    const manager = await getTestManager([syncA, syncB]);

    await writeToAndUpdateSync(() => noop, { ...syncA }, "UPDATE");
    expect(manager.getValue()).toEqual("A");

    await manager.poll();
    expect(manager.getValue()).toEqual("UPDATE");
    expect((await readFromSync(() => noop, syncB)).value?.value).toEqual("UPDATE");
});

test("Successfully polls on schedule and writes to remotes", async () => {
    const syncA = await getTestSync({ value: "A" });
    const syncB = await getTestSync({ value: "A" });
    const manager = await getTestManager([syncA, syncB], { pollPeriodInSeconds: DELAY / 1000 });

    await writeToAndUpdateSync(() => noop, { ...syncA }, "UPDATE");
    expect(manager.getValue()).toEqual("A");

    await delay(DELAY * 1.5);
    expect(manager.getValue()).toEqual("UPDATE");
    expect((await readFromSync(() => noop, syncB)).value?.value).toEqual("UPDATE");
});

test("Successfully writes only to synced syncs", async () => {
    const syncA = await getTestSync({ value: "A" });
    const syncB = await getTestSync({ value: "A" });
    const manager = await getTestManager([syncA, syncB]);
    syncB.desynced = true;

    await manager.setValueAndAsyncPushToSyncs("B");

    expect((await readFromSync(() => noop, syncA)).value?.value).toEqual("B");
    expect((await readFromSync(() => noop, syncB)).value?.value).toEqual("A");
});

/**
 * Compound Tests
 */

test.todo("Calls onSyncsUpdate once with multiple changes (eg. add sync and desync another one)");
test.todo("Correctly recovers from desyncs by calling conflict handler");
test.todo("Correctly recovers from descyncs without needing conflict handler");
test.todo("Correctly logs during read/write cycle");
test.todo("Correctly handles new value during operation, then queued addition/removal operations");

/**
 * Multiple Manager Tests
 */

test.todo("Handles competing writes to same source with broadcast");
test.todo("Handles competing writes to same source without broadcast");
test.todo("Handles poll soon after new value from broadcast");
test.todo("Handles broadcast => write => sync");
// ...More?
// Broadcast with each operation?

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
