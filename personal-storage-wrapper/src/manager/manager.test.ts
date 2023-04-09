/**
 * @vitest-environment jsdom
 */

import { expect, test, vi } from "vitest";
import { DefaultDeserialisers, DefaultTargetsType, MemoryTarget } from "../main";
import { MemoryTargetSerialisationConfig } from "../targets/memory/types";
import { noop } from "../utilities/data";
import { ListBuffer } from "../utilities/listbuffer";
import { PersonalStorageManager } from "./manager";
import { ConflictingRemoteBehaviour, PSMCreationConfig, Sync, SyncFromTargets } from "./types";
import { PSMBroadcastChannel } from "./utilities/channel";
import { readFromSync, writeToAndUpdateSync } from "./utilities/requests";
import { getConfigFromSyncs } from "./utilities/serialisation";
import { delay, getTestSync } from "./utilities/test";

const DELAY = 20;
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

    expect(await value(syncA)).toBe("B");
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

    expect(await value(syncA)).toBe("C");
    expect(await value(syncB)).toBe("C");
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
    expect(listener).toHaveBeenCalledWith({ value: "B", timestamp: expect.any(Date) });
    expect(await value(syncA)).toBe("A");

    await delay(DELAY * 1);

    expect(listener).toHaveBeenCalledOnce(); // Doesn't clobber new value after remote read
    expect(await value(syncA)).toBe("B");
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

    await delay(DELAY);
    expect(listener).toHaveBeenCalledOnce();
    expect(getConfigFromSyncs(listener.mock.calls[0][0])).toEqual(getConfigFromSyncs([syncA]));
    listener.mockClear();

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

    await delay(DELAY);
    expect(listener).toHaveBeenCalledOnce();
    expect(getConfigFromSyncs(listener.mock.calls[0][0])).toEqual(getConfigFromSyncs([syncA, syncB]));
    listener.mockClear();

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
    channel.sendNewValue({ value: "UPDATE", timestamp: new Date() });
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
    expect(await value(syncB)).toEqual("UPDATE");
});

test("Successfully polls on schedule and writes to remotes", async () => {
    const syncA = await getTestSync({ value: "A" });
    const syncB = await getTestSync({ value: "A" });
    const manager = await getTestManager([syncA, syncB], { pollPeriodInSeconds: DELAY / 1000 });

    await writeToAndUpdateSync(() => noop, { ...syncA }, "UPDATE");
    expect(manager.getValue()).toEqual("A");

    await delay(DELAY * 1.5);
    expect(manager.getValue()).toEqual("UPDATE");
    expect(await value(syncB)).toEqual("UPDATE");
});

test("Successfully writes only to synced syncs", async () => {
    const syncA = await getTestSync({ value: "A" });
    const syncB = await getTestSync({ value: "A" });
    const manager = await getTestManager([syncA, syncB]);
    syncB.desynced = true;

    await manager.setValueAndAsyncPushToSyncs("B");

    expect(await value(syncA)).toEqual("B");
    expect(await value(syncB)).toEqual("A");
});

test("Updates callbacks in real time on cached creation", async () => {
    const id = "realtime-callback-update-on-cache-creation";
    const sync = await getTestSync({ delay: DELAY });

    const logger1 = vi.fn();
    const handler1 = vi.fn();
    const manager1 = getTestManager(
        [sync],
        { handleSyncOperationLog: logger1, id, onSyncStatesUpdate: handler1 },
        true
    );
    const logger2 = vi.fn();
    const handler2 = vi.fn();
    const manager2 = await getTestManager(
        [sync],
        { handleSyncOperationLog: logger2, id, onSyncStatesUpdate: handler2 },
        true
    );

    await delay(DELAY * 1.5);

    (sync.target as MemoryTarget).fails = true;
    const logger3 = vi.fn();
    const manager3 = await getTestManager([sync], { handleSyncOperationLog: logger3, id }, true);
    await manager3.poll();

    await delay(DELAY);

    expect(await manager1).toBe(manager2);
    expect(await manager1).toBe(manager3);
    expect(handler1).not.toHaveBeenCalled();
    expect(handler2).toHaveBeenCalled();
    expect(logger1).not.toHaveBeenCalled();
    expect(logger2).toHaveBeenCalledTimes(4);
    expect(logger2).toHaveBeenCalledWith({ operation: "DOWNLOAD", stage: "START", sync });
    expect(logger2).toHaveBeenCalledWith({ operation: "DOWNLOAD", stage: "SUCCESS", sync });
    expect(logger2).toHaveBeenCalledWith({ operation: "UPLOAD", stage: "START", sync });
    expect(logger2).toHaveBeenCalledWith({ operation: "UPLOAD", stage: "SUCCESS", sync });
    expect(logger3).toHaveBeenCalledOnce();
    expect(logger3).toHaveBeenCalledWith({ operation: "POLL", stage: "OFFLINE", sync });
});

/**
 * Compound Tests
 */

test("Calls onSyncsUpdate once with multiple changes (eg. add sync and desync another one)", async () => {
    const handler = vi.fn();

    const syncA = await getTestSync({ value: "A" });
    const manager = await getTestManager([syncA], {
        resolveConflictingSyncsUpdate: async () => "B",
        onSyncStatesUpdate: handler,
    });

    await delay(DELAY);
    expect(handler).toHaveBeenCalledOnce();
    handler.mockClear();

    (syncA.target as MemoryTarget).fails = true;
    const syncB = await getTestSync({ value: "B" });
    await manager.addSync(syncB);

    await delay(DELAY);
    expect(handler).toHaveBeenCalledOnce();
});

test("Correctly recovers from desyncs by calling conflict handler", async () => {
    const resolveConflictingSyncsUpdate = vi.fn();
    resolveConflictingSyncsUpdate.mockImplementation(() => "D");

    const syncA = await getTestSync({ value: "A" });
    const syncB = await getTestSync({ value: "A" });
    const syncC = await getTestSync({ value: "A" });
    const manager = await getTestManager([syncA, syncB, syncC], { resolveConflictingSyncsUpdate });

    await writeToAndUpdateSync(() => noop, { ...syncA }, "A");
    await writeToAndUpdateSync(() => noop, { ...syncB }, "B");
    (syncA.target as MemoryTarget).fails = true;
    (syncB.target as MemoryTarget).fails = true;

    await manager.setValueAndAsyncPushToSyncs("C");
    expect(syncA.desynced).toBe(true);
    expect(syncB.desynced).toBe(true);

    expect(resolveConflictingSyncsUpdate).not.toHaveBeenCalled();
    (syncA.target as MemoryTarget).fails = false;
    (syncB.target as MemoryTarget).fails = false;
    await manager.poll();

    expect(syncA.desynced).toBe(false);
    expect(syncB.desynced).toBe(false);
    expect(resolveConflictingSyncsUpdate).toHaveBeenCalledOnce();
    expect(resolveConflictingSyncsUpdate).toHaveBeenCalledWith<
        Parameters<ConflictingRemoteBehaviour<DefaultTargetsType, string>>
    >(
        "C",
        [syncA, syncB, syncC],
        [
            { sync: syncA, value: { value: "A", timestamp: expect.any(Date) } },
            { sync: syncB, value: { value: "B", timestamp: expect.any(Date) } },
        ]
    );
    expect(manager.getValue()).toBe("D");
    expect(await value(syncA)).toEqual("D");
    expect(await value(syncB)).toEqual("D");
    expect(await value(syncC)).toEqual("D");
});

test("Correctly recovers from descyncs without needing conflict handler", async () => {
    const resolveConflictingSyncsUpdate = vi.fn();

    const syncA = await getTestSync({ value: "A" });
    const syncB = await getTestSync({ value: "A" });
    const manager = await getTestManager([syncA, syncB], { resolveConflictingSyncsUpdate });

    await writeToAndUpdateSync(() => noop, { ...syncA }, "B");
    (syncA.target as MemoryTarget).fails = true;

    await manager.setValueAndAsyncPushToSyncs("B");
    expect(syncA.desynced).toBe(true);

    expect(resolveConflictingSyncsUpdate).not.toHaveBeenCalled();
    (syncA.target as MemoryTarget).fails = false;
    await manager.poll();

    expect(syncA.desynced).toBe(false);
    expect(resolveConflictingSyncsUpdate).not.toHaveBeenCalled();
    expect(manager.getValue()).toBe("B");
    expect(await value(syncA)).toEqual("B");
    expect(await value(syncB)).toEqual("B");
});

test("Correctly logs during read/write cycle", async () => {
    const logger = vi.fn().mockImplementation(() => noop);

    const syncA = await getTestSync({ value: "A" });
    const syncB = await getTestSync({ value: "A", fails: true });
    const manager = await getTestManager([syncA, syncB], { handleSyncOperationLog: logger });

    expect(logger).toHaveBeenCalledTimes(3);
    expect(logger).toHaveBeenCalledWith({ operation: "DOWNLOAD", stage: "START", sync: syncA });
    expect(logger).toHaveBeenCalledWith({ operation: "DOWNLOAD", stage: "SUCCESS", sync: syncA });
    expect(logger).toHaveBeenCalledWith({ operation: "DOWNLOAD", stage: "OFFLINE", sync: syncB });
    logger.mockClear();

    (syncB.target as MemoryTarget).fails = false;
    await manager.poll();

    expect(logger).toHaveBeenCalledTimes(6);
    expect(logger).toHaveBeenCalledWith({ operation: "POLL", stage: "START", sync: syncA });
    expect(logger).toHaveBeenCalledWith({ operation: "POLL", stage: "SUCCESS", sync: syncA });
    expect(logger).toHaveBeenCalledWith({ operation: "POLL", stage: "START", sync: syncB });
    expect(logger).toHaveBeenCalledWith({ operation: "POLL", stage: "SUCCESS", sync: syncB });
    expect(logger).toHaveBeenCalledWith({ operation: "DOWNLOAD", stage: "START", sync: syncB });
    expect(logger).toHaveBeenCalledWith({ operation: "DOWNLOAD", stage: "SUCCESS", sync: syncB });
    logger.mockClear();

    await manager.setValueAndAsyncPushToSyncs("B");

    expect(logger).toHaveBeenCalledTimes(4);
    expect(logger).toHaveBeenCalledWith({ operation: "UPLOAD", stage: "START", sync: syncA });
    expect(logger).toHaveBeenCalledWith({ operation: "UPLOAD", stage: "SUCCESS", sync: syncA });
    expect(logger).toHaveBeenCalledWith({ operation: "UPLOAD", stage: "START", sync: syncB });
    expect(logger).toHaveBeenCalledWith({ operation: "UPLOAD", stage: "SUCCESS", sync: syncB });
});

test("Correctly handles new value during operation, then queued addition/removal operations", async () => {
    const syncA = await getTestSync({ value: "A" });
    const syncB = await getTestSync({ value: "A", delay: DELAY });
    const syncC = await getTestSync({ value: "C" });
    const manager = await getTestManager([syncA, syncB], { resolveConflictingSyncsUpdate: async () => "D" });
    await delay(DELAY * 1.5);

    await Promise.all([
        manager.poll(),
        manager.setValueAndAsyncPushToSyncs("B"),
        manager.addSync(syncC),
        manager.removeSync(syncB),
    ]);

    expect(await value(syncA)).toBe("D");
    expect(await value(syncB)).toBe("A"); // Removals before additions
    expect(await value(syncC)).toBe("D");
    expect(manager.getSyncsState()).toEqual([syncA, syncC]);
});

test("Writes to empty syncs with fallback values", async () => {
    const syncA = await getTestSync();
    const syncB = await getTestSync({ fails: true });
    await getTestManager([syncA, syncB]);

    expect(await value(syncA)).toBe("DEFAULT_VALUE");
});

/**
 * Multiple Manager Tests
 */

test("Handles overlapping writes to same source with broadcast", async () => {
    const id = "overlapping-writes-to-same-source";

    const sync = await getTestSync({ value: "A" });
    const managerA = await getTestManager([sync], { id, resolveConflictingSyncsUpdate: async () => "D" });
    const managerB = await getTestManager([{ ...sync }], { id, ignoreDuplicateCheck: true });

    managerA.setValueAndAsyncPushToSyncs("B");
    managerB.setValueAndAsyncPushToSyncs("C");

    await delay(DELAY); // For broadcasting to complete
    expect(managerA.getValue()).toBe("C");
    expect(managerB.getValue()).toBe("C");
    expect(await value(sync)).toBe("C");
});

test("Handles overlapping writes to same source without broadcast", async () => {
    const resolveConflictingSyncsUpdate = vi.fn();

    const sync = await getTestSync({ value: "A", delay: DELAY });
    const managerA = await getTestManager([sync], { resolveConflictingSyncsUpdate });
    const managerB = await getTestManager([{ ...sync }], { resolveConflictingSyncsUpdate });

    managerA.setValueAndAsyncPushToSyncs("B");
    await delay(DELAY * 0.2);
    managerB.setValueAndAsyncPushToSyncs("C");

    await delay(DELAY * 2.5); // Wait for any dust to settle
    expect(managerA.getValue()).toBe("B");
    expect(managerB.getValue()).toBe("C");
    expect(await value(sync)).toBe("C");

    await managerA.poll();
    expect(managerA.getValue()).toBe("C");
    expect(managerB.getValue()).toBe("C");
    expect(await value(sync)).toBe("C");

    expect(resolveConflictingSyncsUpdate).not.toHaveBeenCalled();
});

test("Handles poll soon after new value from broadcast", async () => {
    const id = "poll-after-broadcast";

    const sync = await getTestSync({ value: "A" });
    const managerA = await getTestManager([sync], { id });
    const managerB = await getTestManager([{ ...sync }], { id, ignoreDuplicateCheck: true });

    (sync.target as MemoryTarget).delay = DELAY * 2;
    managerA.setValueAndAsyncPushToSyncs("B");

    await delay(DELAY * 0.5);
    (sync.target as MemoryTarget).delay = 0;

    expect(managerB.getValue()).toEqual("B");
    expect(await value(sync)).toBe("A");
    await managerB.poll();
    expect(managerB.getValue()).toEqual("B");
    expect(await value(sync)).toBe("A");

    await delay(DELAY * 2);

    expect(managerB.getValue()).toEqual("B");
    expect(await value(sync)).toBe("B");
    await managerB.poll();
    expect(managerB.getValue()).toEqual("B");
    expect(await value(sync)).toBe("B");
});

/**
 * Utilities
 */

let id = 0;
const getTestManager = async (
    syncs: SyncFromTargets<DefaultTargetsType>[],
    config?: Partial<PSMCreationConfig<string, DefaultTargetsType>>,
    cache?: boolean
) =>
    (cache ? PersonalStorageManager.createWithCache : PersonalStorageManager.create)(DEFAULT_VALUE, {
        getDefaultSyncs: () => Promise.resolve(syncs),
        getSyncData: () => null,
        saveSyncData: noop,
        id: "" + id++,
        pollPeriodInSeconds: null,
        ...config,
    });

const value = async (sync: Sync<"memory", MemoryTargetSerialisationConfig>) =>
    (await readFromSync(() => noop, sync)).value?.value;
