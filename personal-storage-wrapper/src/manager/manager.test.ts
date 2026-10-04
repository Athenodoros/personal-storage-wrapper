/**
 * @vitest-environment jsdom
 */

import { expect, test, vi } from "vitest";
import { DefaultDeserialisers } from "../main";
import { MemoryTarget } from "../targets";
import { noop } from "../utilities/data";
import { ListBuffer } from "../utilities/listbuffer";
import { PersonalStorageManager } from "./manager";
import { ConflictingRemoteBehaviour, PSMCreationConfig, Sync } from "./types";
import { PSMBroadcastChannel } from "./utilities/channel";
import { DefaultTarget } from "./utilities/defaults";
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

    const id = "conflicting-results-update-handler-check";
    getTestManager([syncA, syncB], { resolveConflictingSyncValuesOnStartup: async () => "C", id }, true);
    const manager = await getTestManager(
        [syncA, syncB],
        { resolveConflictingSyncValuesOnStartup: async () => "D", id },
        true
    );

    expect(new Date().valueOf() - start).toBeLessThan(DELAY * 0.5);
    expect(manager.getValue()).toBe("A");
    await delay(DELAY * 3.5);
    expect(manager.getValue()).toBe("D");

    expect(await value(syncA)).toBe("D");
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

    manager.setValue("B");
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
    let current: string | undefined;
    const handler = vi.fn(async (original: string, getCurrentValue: () => string) => {
        current = getCurrentValue();
        return original;
    });

    const syncA = await getTestSync({ value: "A" });
    const syncB = await getTestSync({ value: "B", delay: DELAY });
    const manager = await getTestManager([syncA, syncB], {
        resolveConflictingSyncValuesOnStartup: handler,
    });
    manager.setValue("C");

    const valueA = (await readFromSync(() => noop, syncA)).value;
    const valueB = (await readFromSync(() => noop, syncB)).value;
    await delay(DELAY * 1.5);

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith("A", expect.any(Function), [
        { sync: syncA, value: valueA },
        { sync: syncB, value: valueB },
    ]);
    expect(current).toBe("C");
});

test("Keeps edits made while the startup conflict handler runs, if it keeps the current value", async () => {
    const onValueUpdate = vi.fn();
    let decide = noop;
    const resolveConflictingSyncValuesOnStartup = (_: string, getCurrentValue: () => string) =>
        new Promise<string>((resolve) => (decide = () => resolve(getCurrentValue())));

    const syncA = await getTestSync({ value: "A" });
    const syncB = await getTestSync({ value: "B", delay: DELAY });
    const manager = await getTestManager([syncA, syncB], { onValueUpdate, resolveConflictingSyncValuesOnStartup });

    // The handler might be waiting on the user, who goes on editing
    await delay(DELAY * 1.5);
    manager.setValue("C");
    decide();
    await delay(DELAY * 2.5);

    expect(manager.getValue()).toBe("C");
    expect(await value(syncA)).toBe("C");
    expect(await value(syncB)).toBe("C");

    // The application already holds it, so it isn't told of it again as though it were new
    expect(onValueUpdate).not.toHaveBeenCalledWith("C", "CONFLICT");
});

test("Takes the value the startup conflict handler returns, over edits made while it ran", async () => {
    let decide = noop;
    const resolveConflictingSyncValuesOnStartup = (original: string) =>
        new Promise<string>((resolve) => (decide = () => resolve(original)));

    const syncA = await getTestSync({ value: "A" });
    const syncB = await getTestSync({ value: "B", delay: DELAY });
    const manager = await getTestManager([syncA, syncB], { resolveConflictingSyncValuesOnStartup });

    await delay(DELAY * 1.5);
    manager.setValue("C");
    decide();
    await delay(DELAY * 2.5);

    expect(manager.getValue()).toBe("A");
    expect(await value(syncA)).toBe("A");
    expect(await value(syncB)).toBe("A");
});

test("Keeps an edit made while the result of a startup conflict is written", async () => {
    let decided = noop;
    const handled = new Promise<void>((resolve) => (decided = resolve));
    const resolveConflictingSyncValuesOnStartup = async () => {
        decided();
        return "X";
    };

    const syncA = await getTestSync({ value: "A" });
    const syncB = await getTestSync({ value: "B", delay: DELAY });
    const manager = await getTestManager([syncA, syncB], { resolveConflictingSyncValuesOnStartup });

    // The slower target is still being written when the user edits
    await handled;
    await delay(DELAY * 0.5);
    manager.setValue("D");
    await delay(DELAY * 3);

    expect(manager.getValue()).toBe("D");
    expect(await value(syncA)).toBe("D");
    expect(await value(syncB)).toBe("D");
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

test("Writes again to a sync that missed a write, if nothing else has written to it", async () => {
    const syncA = await getTestSync({ value: "A" });
    const syncB = await getTestSync({ value: "A" });
    const manager = await getTestManager([syncA, syncB]);
    await delay(1); // Startup finds the manager's value in it, and records it as in step
    syncB.missedWrite = true;

    const result = await manager.setValue("B");

    expect(result.saved).toEqual([syncA, syncB]);
    expect(await value(syncB)).toEqual("B");
    expect(manager.getSyncsState()[1].missedWrite).toBe(false);
});

test("Reconciles a sync that missed a write and has moved on before writing to it", async () => {
    const resolveConflictingSyncsUpdate = vi.fn(async (local: string) => local);
    const syncA = await getTestSync({ value: "A" });
    const syncB = await getTestSync({ value: "A" });
    const manager = await getTestManager([syncA, syncB], { resolveConflictingSyncsUpdate });
    await delay(1); // Startup finds the manager's value in it, and records it as in step

    // Its write failed, and since then something else has written to it
    syncB.missedWrite = true;
    await delay(1);
    await writeToAndUpdateSync(() => noop, { ...syncB }, "OTHER");

    const result = await manager.setValue("B");
    expect(result.saved).toEqual([syncA]);
    expect(result.failed).toEqual([syncB]);

    // A poll is run for it straight away, even with polling off, and the conflict handler decides
    await delay(DELAY);
    expect(resolveConflictingSyncsUpdate).toHaveBeenCalledWith("B", expect.anything(), [
        { sync: syncB, value: expect.objectContaining({ value: "OTHER" }) },
    ]);
    expect(await value(syncB)).toEqual("B");
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

    await manager.setValue("C");
    expect(syncA.missedWrite).toBe(true);
    expect(syncB.missedWrite).toBe(true);

    expect(resolveConflictingSyncsUpdate).not.toHaveBeenCalled();
    (syncA.target as MemoryTarget).fails = false;
    (syncB.target as MemoryTarget).fails = false;
    await manager.poll();

    expect(syncA.missedWrite).toBe(false);
    expect(syncB.missedWrite).toBe(false);
    expect(resolveConflictingSyncsUpdate).toHaveBeenCalledOnce();
    expect(resolveConflictingSyncsUpdate).toHaveBeenCalledWith<
        Parameters<ConflictingRemoteBehaviour<string, DefaultTarget>>
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

    await manager.setValue("B");
    expect(syncA.missedWrite).toBe(true);

    expect(resolveConflictingSyncsUpdate).not.toHaveBeenCalled();
    (syncA.target as MemoryTarget).fails = false;
    await manager.poll();

    expect(syncA.missedWrite).toBe(false);
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

    await manager.setValue("B");

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

    await Promise.all([manager.poll(), manager.setValue("B"), manager.addSync(syncC), manager.removeSync(syncB)]);

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

    managerA.setValue("B");
    managerB.setValue("C");

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

    managerA.setValue("B");
    await delay(DELAY * 0.2);
    managerB.setValue("C");

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
    managerA.setValue("B");

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
 * Shutdown
 */

test("Stops responding to anything once closed, and frees its id for reuse", async () => {
    const sync = await getTestSync({ value: "A" });
    const onValueUpdate = vi.fn();

    const manager = await getTestManager([sync], { id: "closed-manager", onValueUpdate });
    await delay(DELAY);
    onValueUpdate.mockClear();

    manager.close();

    await manager.setValue("B");
    await delay(DELAY);
    expect(onValueUpdate).not.toHaveBeenCalled();
    expect(await value(sync)).toBe("A");

    // The duplicate check no longer trips, so a fresh manager can take the same id
    const replacement = await getTestManager([sync], { id: "closed-manager" });
    expect(replacement.getValue()).toBe("A");
    replacement.close();
});

test("Stops listening to other managers once closed", async () => {
    const onValueUpdate = vi.fn();

    const listener = await getTestManager([], { id: "shared-channel-id", onValueUpdate });
    const speaker = await getTestManager([], { id: "shared-channel-id", ignoreDuplicateCheck: true });
    await delay(DELAY);
    onValueUpdate.mockClear();

    listener.close();
    await speaker.setValue("BROADCAST");
    await delay(DELAY);

    expect(onValueUpdate).not.toHaveBeenCalled();
    expect(listener.getValue()).toBe(DEFAULT_VALUE);

    speaker.close();
});

/**
 * An operation runner calls into application code - a conflict handler, most obviously - and that
 * can throw. The queue has to come back from it: before it did, `running` stayed set for the life
 * of the page, so every later write queued behind the failure and never ran, and the promises they
 * were handed never settled either, so nothing said anything was wrong.
 */
test("Hands the operation queue back when an operation fails", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(noop);

    const existing = await getTestSync({ value: DEFAULT_VALUE });
    const conflicting = await getTestSync({ value: "REMOTE" });
    const manager = await getTestManager([existing], {
        resolveConflictingSyncsUpdate: async () => {
            throw new Error("The application's conflict handler failed");
        },
    });

    await withTimeout(manager.addTarget(conflicting.target, false));
    expect(errors).toHaveBeenCalled();

    await withTimeout(manager.setValue("AFTER"));
    await delay(DELAY);
    expect(await value(existing)).toBe("AFTER");

    errors.mockRestore();
    manager.close();
});

/**
 * Values that can't be used, start values and save results
 */

/** A sync whose target holds bytes that don't decode to anything */
const getCorruptSync = (): Sync<MemoryTarget> => ({
    target: new MemoryTarget({
        value: { timestamp: new Date(), buffer: new Uint8Array([1, 2, 3]).buffer },
        preserveValueOnSave: true,
    }),
    compressed: true,
});

const rawBuffer = async (sync: Sync<MemoryTarget>) => (await sync.target.read()).value?.buffer;

test("Takes a value another context saved while this one was reading", async () => {
    // Saved a second ago, and read just now
    const id = "saved-while-reading";
    const sync = await getTestSync({ value: "A", timestamp: new Date().valueOf() - 1000 });
    const manager = await getTestManager([sync], { id });

    // The other context's save landed after that one, but before this manager was created
    const channel = new PSMBroadcastChannel(id, new ListBuffer<string>(), DefaultDeserialisers, noop, noop);
    channel.sendNewValue({ value: "B", timestamp: new Date(new Date().valueOf() - 500) });
    await delay(DELAY);

    expect(manager.getValue()).toBe("B");
    channel.close();
    manager.close();
});

test("Rejects creation when the initial value can't be made, and lets the id be used again", async () => {
    const config = { getDefaultSyncs: async () => [await getTestSync()], getSyncData: () => null, id: "failed-start" };

    await expect(
        withTimeout(
            PersonalStorageManager.create<string>(() => {
                throw new Error("No initial value");
            }, config)
        )
    ).rejects.toThrow("No initial value");

    const { manager } = await withTimeout(PersonalStorageManager.create("AFTER", config));
    expect(manager.getValue()).toBe("AFTER");
    manager.close();
});

test("Rejects creation when the handler for failed targets throws", async () => {
    await expect(
        withTimeout(
            getTestManager([await getTestSync({ fails: true })], {
                handleAllEmptyAndFailedSyncsOnStartup: async () => {
                    throw new Error("Handler failed");
                },
            })
        )
    ).rejects.toThrow("Handler failed");
});

test("Tries a cached creation again after one fails", async () => {
    const config = { getDefaultSyncs: async () => [await getTestSync()], getSyncData: () => null, id: "failed-cache" };

    await expect(
        withTimeout(
            PersonalStorageManager.createWithCache<string>(async () => {
                throw new Error("No initial value");
            }, config)
        )
    ).rejects.toThrow();

    const { manager } = await withTimeout(PersonalStorageManager.createWithCache("AFTER", config));
    expect(manager.getValue()).toBe("AFTER");
    manager.close();
});

test("Never writes over a value that won't decode, and says so", async () => {
    const onUnreadableValue = vi.fn();
    const corrupt = getCorruptSync();
    const before = await rawBuffer(corrupt);
    const working = await getTestSync({ value: "A" });

    const manager = await getTestManager([corrupt, working], { onUnreadableValue });
    await delay(DELAY);

    expect(manager.getValue()).toBe("A");
    expect(onUnreadableValue).toHaveBeenCalledWith(
        expect.objectContaining({ error: "CORRUPT_VALUE", buffer: before }),
        { type: "SYNC", sync: corrupt }
    );
    expect(manager.getSyncsState()[0].unreadable).toBe(true);

    const result = await manager.setValue("B");
    expect(result.saved).toEqual([working]);
    expect(result.failed).toEqual([corrupt]);
    expect(await rawBuffer(corrupt)).toBe(before);
    expect(await value(working)).toBe("B");

    manager.close();
});

test("Treats a value that fails validation like one that won't decode", async () => {
    const onUnreadableValue = vi.fn();
    const handleAllEmptyAndFailedSyncsOnStartup = vi.fn(async () => ({ behaviour: "DEFAULT" as const }));
    const newer = await getTestSync({ value: "FROM A NEWER VERSION" });
    const before = await rawBuffer(newer);

    const manager = await getTestManager([newer], {
        validate: (value) => (value === "FROM A NEWER VERSION" ? "Too new" : null),
        onUnreadableValue,
        handleAllEmptyAndFailedSyncsOnStartup,
    });

    // Nothing usable was found, so the manager starts on its initial value without writing it anywhere
    expect(manager.getValue()).toBe(DEFAULT_VALUE);
    expect(handleAllEmptyAndFailedSyncsOnStartup).toHaveBeenCalledWith([
        { sync: newer, value: expect.objectContaining({ error: "CORRUPT_VALUE", detail: "Too new" }) },
    ]);
    expect(onUnreadableValue).toHaveBeenCalledWith(
        expect.objectContaining({ detail: "Too new", decoded: "FROM A NEWER VERSION", buffer: before }),
        { type: "SYNC", sync: newer }
    );

    await manager.setValue("B");
    expect(await rawBuffer(newer)).toBe(before);

    manager.close();
});

test("Refuses a value from another context that fails validation", async () => {
    const id = "invalid-broadcast";
    const onUnreadableValue = vi.fn();
    const onValueUpdate = vi.fn();
    const manager = await getTestManager([], {
        id,
        validate: (value) => (value === "INVALID" ? "Not allowed" : null),
        onUnreadableValue,
        onValueUpdate,
    });

    const channel = new PSMBroadcastChannel(id, new ListBuffer<string>(), DefaultDeserialisers, noop, noop);
    channel.sendNewValue({ value: "INVALID", timestamp: new Date() });
    await delay(DELAY);

    expect(manager.getValue()).toBe(DEFAULT_VALUE);
    expect(onValueUpdate).not.toHaveBeenCalledWith("INVALID", expect.anything());
    expect(onUnreadableValue).toHaveBeenCalledWith(
        expect.objectContaining({ error: "CORRUPT_VALUE", detail: "Not allowed", decoded: "INVALID" }),
        { type: "BROADCAST" }
    );

    channel.close();
    manager.close();
});

test("Never saves whether a target was unreadable", async () => {
    const manager = await getTestManager([getCorruptSync()]);

    expect(manager.getSyncsState()[0].unreadable).toBe(true);
    expect(getConfigFromSyncs(manager.getSyncsState())).not.toContain("unreadable");
    manager.close();
});

test("Writes to a target again once a poll finds it empty", async () => {
    const corrupt = getCorruptSync();
    const manager = await getTestManager([corrupt]);
    expect(manager.getSyncsState()[0].unreadable).toBe(true);

    corrupt.target.value = null;
    await manager.poll();

    expect(manager.getSyncsState()[0].unreadable).toBe(false);
    expect(await value(corrupt)).toBe(DEFAULT_VALUE);
    manager.close();
});

test("Says where its starting value came from", async () => {
    const fromTarget = await getTestCreation([await getTestSync({ value: "A" })]);
    expect(fromTarget.startSource).toBe("TARGET");

    const fromInitial = await getTestCreation([await getTestSync()]);
    expect(fromInitial.startSource).toBe("INITIAL");

    const fromFallback = await getTestCreation([await getTestSync({ fails: true })], {
        handleAllEmptyAndFailedSyncsOnStartup: async () => ({ behaviour: "VALUE", value: "FALLBACK" }),
    });
    expect(fromFallback.startSource).toBe("FALLBACK");
    expect(fromFallback.manager.getValue()).toBe("FALLBACK");

    [fromTarget, fromInitial, fromFallback].forEach(({ manager }) => manager.close());
});

test("Says which syncs a value was saved to", async () => {
    const working = await getTestSync({ value: "A" });
    const failing = await getTestSync({ value: "A" });
    const manager = await getTestManager([working, failing]);
    await delay(DELAY);

    failing.target.fails = true;
    const result = await manager.setValue("B");

    expect(result.saved).toEqual([working]);
    expect(result.failed).toEqual([failing]);
    manager.close();
});

test("Hands out copies of its syncs with a save result", async () => {
    const manager = await getTestManager([await getTestSync({ value: "A" })]);
    await delay(DELAY);

    const result = await manager.setValue("B");
    result.saved[0].missedWrite = true;

    expect(manager.getSyncsState()[0].missedWrite).toBe(false);
    manager.close();
});

test("Starts, and keeps taking values, when onUnreadableValue throws", async () => {
    const id = "throwing-unreadable-handler";
    const onUnreadableValue = vi.fn(() => {
        throw new Error("Application bug");
    });
    const error = vi.spyOn(console, "error").mockImplementation(noop);

    const manager = await withTimeout(
        getTestManager([getCorruptSync()], {
            id,
            onUnreadableValue,
            validate: (value) => (value === "INVALID" ? "Not allowed" : null),
        })
    );
    expect(onUnreadableValue).toHaveBeenCalledOnce();

    const channel = new PSMBroadcastChannel(id, new ListBuffer<string>(), DefaultDeserialisers, noop, noop);
    channel.sendNewValue({ value: "INVALID", timestamp: new Date() });
    await delay(DELAY);
    expect(onUnreadableValue).toHaveBeenCalledTimes(2);

    channel.sendNewValue({ value: "VALID", timestamp: new Date() });
    await delay(DELAY);
    expect(manager.getValue()).toBe("VALID");
    await withTimeout(manager.poll());

    channel.close();
    manager.close();
    error.mockRestore();
});

test("Reports an unreadable value once, until something writes over it", async () => {
    const onUnreadableValue = vi.fn();
    const corrupt = getCorruptSync();
    const manager = await getTestManager([corrupt, await getTestSync({ value: "A" })], { onUnreadableValue });
    await delay(DELAY);
    expect(onUnreadableValue).toHaveBeenCalledOnce();

    await manager.poll();
    await manager.poll();
    expect(onUnreadableValue).toHaveBeenCalledOnce();

    // Something else writes another value it can't use
    corrupt.target.value = { timestamp: new Date(Date.now() + 1000), buffer: new Uint8Array([4, 5, 6]).buffer };
    await manager.poll();
    expect(onUnreadableValue).toHaveBeenCalledTimes(2);
    expect(manager.getSyncsState()[0].unreadable).toBe(true);

    manager.close();
});

test("Saves a value set during startup to every sync, alongside the write to an empty one", async () => {
    const full = await getTestSync({ value: "A" });
    const empty = await getTestSync({ delay: DELAY });
    const manager = await getTestManager([full, empty]);

    // Set while startup still waits on the empty sync, which it then queues a write to
    const result = await manager.setValue("B");

    expect(result.saved).toEqual([full, empty]);
    expect(await value(full)).toBe("B");
    expect(await value(empty)).toBe("B");
    manager.close();
});

test("Says where its syncs came from", async () => {
    const sync = await getTestSync({ value: "A" });
    const saved = await getTestCreation([], { getSyncData: () => getConfigFromSyncs([sync]) });
    expect(saved.syncsSource).toBe("SAVED");
    expect(saved.manager.getValue()).toBe("A");

    const defaults = await getTestCreation([sync]);
    expect(defaults.syncsSource).toBe("DEFAULT");

    [saved, defaults].forEach(({ manager }) => manager.close());
});

test("Starts from the default syncs when the saved ones can't be read", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(noop);
    const sync = await getTestSync({ value: "A" });

    // Not JSON, an entry that isn't, and a saved list that can't be fetched at all
    const unreadable = [
        () => "not json",
        () => JSON.stringify([{ type: "memory", config: "not json" }]),
        () => {
            throw new Error("Blocked");
        },
    ];

    for (const getSyncData of unreadable) {
        const { manager, syncsSource } = await withTimeout(getTestCreation([sync], { getSyncData }));
        expect(syncsSource).toBe("UNREADABLE");
        expect(manager.getSyncsState()).toEqual([sync]);
        expect(manager.getValue()).toBe("A");
        manager.close();
    }

    expect(error).toHaveBeenCalledTimes(unreadable.length);
    error.mockRestore();
});

/**
 * Utilities
 */

const withTimeout = <T>(promise: Promise<T>) =>
    Promise.race([
        promise,
        delay(DELAY * 10).then(() => {
            throw new Error("The operation never returned");
        }),
    ]);

let id = 0;
const getTestCreation = async (
    syncs: Sync<DefaultTarget>[],
    config?: Partial<PSMCreationConfig<string, DefaultTarget>>,
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

const getTestManager = async (...args: Parameters<typeof getTestCreation>) =>
    (await getTestCreation(...args)).manager;

const value = async (sync: Sync<MemoryTarget>) => (await readFromSync(() => noop, sync)).value?.value;

test("Says on a later startup which target missed a write", async () => {
    const syncA = await getTestSync({ value: "A" });
    const syncB = await getTestSync({ value: "A" });
    const first = await getTestManager([syncA, syncB]);
    await delay(1);

    // Saved while one target could be reached and the other couldn't
    (syncB.target as MemoryTarget).fails = true;
    await first.setValue("B");
    (syncB.target as MemoryTarget).fails = false;
    const saved = getConfigFromSyncs(first.getSyncsState());
    first.close();

    // Copied as the handler sees them, since startup goes on to write to the syncs it is given
    let seen: [string, boolean][] = [];
    const resolveConflictingSyncValuesOnStartup = async (
        original: string,
        _: () => string,
        syncs: { sync: Sync; value: { value: string } }[]
    ) => {
        seen = syncs.map(({ sync, value }) => [value.value, sync.missedWrite ?? false]);
        return original;
    };
    const second = await getTestManager([], { getSyncData: () => saved, resolveConflictingSyncValuesOnStartup });
    await delay(DELAY);

    expect(seen).toEqual([
        ["B", false],
        ["A", true],
    ]);

    // Once it has the value, it no longer says so
    expect(second.getSyncsState().map(({ missedWrite }) => missedWrite)).toEqual([false, false]);
});
