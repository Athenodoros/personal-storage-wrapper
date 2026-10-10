/**
 * @vitest-environment jsdom
 */

import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { DefaultDeserialisers } from "../main";
import { MemoryTarget } from "../targets";
import { noop } from "../utilities/data";
import { ListBuffer } from "../utilities/listbuffer";
import { PersonalStorageManager } from "./manager";
import { ConflictingRemoteBehaviour, PSMCreationConfig, Sync } from "./types";
import { PSMBroadcastChannel } from "./utilities/channel";
import { DefaultTarget } from "./utilities/defaults";
import { readFromSync, writeToAndUpdateSync } from "./utilities/requests";
import { getBufferFromValue, getConfigFromSyncs } from "./utilities/serialisation";
import { DELAY, getTestSync, settle } from "./utilities/test";

const DEFAULT_VALUE = "DEFAULT_VALUE";

beforeEach(() => void vi.useFakeTimers());
afterEach(() => void vi.useRealTimers());

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
    const syncA = await getTestSync({ value: "A" });
    const syncB = await getTestSync({ value: "B", delay: DELAY });

    const id = "conflicting-results-update-handler-check";
    const resolveConflictingSyncValuesOnStartup = vi.fn(async () => "D");
    startTestManager([syncA, syncB], { resolveConflictingSyncValuesOnStartup: async () => "C", id }, true);
    const manager = await getTestManager([syncA, syncB], { resolveConflictingSyncValuesOnStartup, id }, true);

    // Created from the first value read, without waiting for the slower sync, so nothing is resolved yet
    expect(resolveConflictingSyncValuesOnStartup).not.toHaveBeenCalled();
    expect(manager.getValue()).toBe("A");
    await vi.advanceTimersByTimeAsync(DELAY);
    expect(manager.getValue()).toBe("D");

    // Written once the conflict is resolved, a step at a time
    await vi.waitFor(async () => expect(await value(syncA)).toBe("D"));
});

test("Handles operations during startup and returns promise to actioned result", async () => {
    const syncA = await getTestSync({ value: "A" });
    const syncB = await getTestSync({ value: "B", delay: DELAY });
    const manager = await getTestManager([syncA, syncB], {
        resolveConflictingSyncValuesOnStartup: async () => "C",
    });

    const promise = manager.removeSync(syncB);
    expect(manager.getValue()).toBe("A");
    await settle(promise);
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
    await vi.advanceTimersByTimeAsync(DELAY * 0.5);
    expect(await value(syncA)).toBe("A");

    await vi.waitFor(() => expect(listener).toHaveBeenCalledOnce());
    expect(listener).toHaveBeenCalledWith({ value: "B", timestamp: expect.any(Date) });

    await vi.advanceTimersByTimeAsync(DELAY);

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

    // What the syncs hold before startup reads them, and writes over the one that disagrees
    const valueA = (await settle(readFromSync(() => noop, syncA))).value;
    const valueB = (await settle(readFromSync(() => noop, syncB))).value;

    const manager = await getTestManager([syncA, syncB], {
        resolveConflictingSyncValuesOnStartup: handler,
    });
    manager.setValue("C");
    await vi.advanceTimersByTimeAsync(DELAY);

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
    await vi.advanceTimersByTimeAsync(DELAY * 1.5);
    manager.setValue("C");
    decide();
    await vi.advanceTimersByTimeAsync(DELAY * 2.5);

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

    await vi.advanceTimersByTimeAsync(DELAY * 1.5);
    manager.setValue("C");
    decide();
    await vi.advanceTimersByTimeAsync(DELAY * 2.5);

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
    await settle(handled);
    await vi.advanceTimersByTimeAsync(DELAY * 0.5);
    manager.setValue("D");
    await vi.advanceTimersByTimeAsync(DELAY * 3);

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

    await vi.waitFor(() => expect(listener).toHaveBeenCalledOnce());
    expect(getConfigFromSyncs(listener.mock.calls[0][0])).toEqual(getConfigFromSyncs([syncA]));
    listener.mockClear();

    const syncB = await getTestSync({ value: "A" });
    await settle(manager.addSync(syncB));
    expect(manager.getSyncsState()).toEqual([syncA, syncB]);

    await vi.waitFor(() => expect(listener).toHaveBeenCalledOnce());
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

    await vi.waitFor(() => expect(listener).toHaveBeenCalledOnce());
    expect(getConfigFromSyncs(listener.mock.calls[0][0])).toEqual(getConfigFromSyncs([syncA, syncB]));
    listener.mockClear();

    await settle(manager.removeSync(syncB));
    expect(manager.getSyncsState()).toEqual([syncA]);

    await vi.waitFor(() => expect(listener).toHaveBeenCalledOnce());
    expect(getConfigFromSyncs(listener.mock.calls[0][0])).toEqual(getConfigFromSyncs([syncA]));
});

test("Successfully updates syncs from channel", async () => {
    const id = "update-sync-broadcast-test";

    const manager = await getTestManager([], { id });

    const channel = new PSMBroadcastChannel(id, new ListBuffer<string>(), DefaultDeserialisers, noop, noop);
    const syncA = await getTestSync({ value: "A" });
    channel.sendUpdatedSyncs([syncA]);

    await vi.waitFor(() => expect(getConfigFromSyncs(manager.getSyncsState())).toEqual(getConfigFromSyncs([syncA])));
});

test("Successfully updates values from channel", async () => {
    const id = "update-value-broadcast-test";
    const manager = await getTestManager([], { id });

    const channel = new PSMBroadcastChannel(id, new ListBuffer<string>(), DefaultDeserialisers, noop, noop);
    channel.sendNewValue({ value: "UPDATE", timestamp: new Date() });

    await vi.waitFor(() => expect(manager.getValue()).toEqual("UPDATE"));
});

test("Successfully polls on manual trigger and writes to remotes", async () => {
    const syncA = await getTestSync({ value: "A" });
    const syncB = await getTestSync({ value: "A" });
    const manager = await getTestManager([syncA, syncB]);

    await settle(writeToAndUpdateSync(() => noop, { ...syncA }, "UPDATE"));
    expect(manager.getValue()).toEqual("A");

    await settle(manager.poll());
    expect(manager.getValue()).toEqual("UPDATE");
    expect(await value(syncB)).toEqual("UPDATE");
});

test("Successfully polls on schedule and writes to remotes", async () => {
    const syncA = await getTestSync({ value: "A" });
    const syncB = await getTestSync({ value: "A" });
    const manager = await getTestManager([syncA, syncB], { pollPeriodInSeconds: DELAY / 1000 });

    await settle(writeToAndUpdateSync(() => noop, { ...syncA }, "UPDATE"));
    expect(manager.getValue()).toEqual("A");

    // The poll is due once the period has passed, and writes to syncB once it has read syncA
    await vi.advanceTimersByTimeAsync(DELAY);
    await vi.waitFor(async () => expect(await value(syncB)).toEqual("UPDATE"));
    expect(manager.getValue()).toEqual("UPDATE");
});

test("Writes again to a sync that missed a write, if nothing else has written to it", async () => {
    const syncA = await getTestSync({ value: "A" });
    const syncB = await getTestSync({ value: "A" });
    const manager = await getTestManager([syncA, syncB]);
    await vi.advanceTimersByTimeAsync(1); // Startup finds the manager's value in it, and records it as in step
    syncB.missedWrite = true;

    const result = await settle(manager.setValue("B"));

    expect(result.saved).toEqual([syncA, syncB]);
    expect(await value(syncB)).toEqual("B");
    expect(manager.getSyncsState()[1].missedWrite).toBe(false);
});

test("Reconciles a sync that missed a write and has moved on before writing to it", async () => {
    const resolveConflictingSyncsUpdate = vi.fn(async (local: string) => local);
    const syncA = await getTestSync({ value: "A" });
    const syncB = await getTestSync({ value: "A" });
    const manager = await getTestManager([syncA, syncB], { resolveConflictingSyncsUpdate });
    await vi.advanceTimersByTimeAsync(1); // Startup finds the manager's value in it, and records it as in step

    // Its write failed, and since then something else has written to it
    syncB.missedWrite = true;
    await vi.advanceTimersByTimeAsync(1);
    await settle(writeToAndUpdateSync(() => noop, { ...syncB }, "OTHER"));

    // Which targets, since the poll it asks for may already have updated the syncs these were copied from
    const result = await settle(manager.setValue("B"));
    expect(result.saved.map(({ target }) => target)).toEqual([syncA.target]);
    expect(result.failed.map(({ target }) => target)).toEqual([syncB.target]);

    // A poll is run for it straight away, even with polling off, and the conflict handler decides
    await vi.advanceTimersByTimeAsync(DELAY);
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
    const manager1 = startTestManager(
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

    // The check and the write of the empty sync, each after the sync's delay
    await vi.advanceTimersByTimeAsync(DELAY * 2);

    (sync.target as MemoryTarget).fails = true;
    const logger3 = vi.fn();
    const manager3 = await getTestManager([sync], { handleSyncOperationLog: logger3, id }, true);
    await settle(manager3.poll());

    await vi.advanceTimersByTimeAsync(DELAY);

    expect(await manager1).toBe(manager2);
    expect(await manager1).toBe(manager3);
    expect(handler1).not.toHaveBeenCalled();
    expect(handler2).toHaveBeenCalled();
    expect(logger1).not.toHaveBeenCalled();
    expect(logger2).toHaveBeenCalledTimes(6);
    expect(logger2).toHaveBeenCalledWith({ operation: "DOWNLOAD", stage: "START", sync });
    expect(logger2).toHaveBeenCalledWith({ operation: "DOWNLOAD", stage: "SUCCESS", sync });
    expect(logger2).toHaveBeenCalledWith({ operation: "POLL", stage: "START", sync });
    expect(logger2).toHaveBeenCalledWith({ operation: "POLL", stage: "SUCCESS", sync });
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

    await vi.advanceTimersByTimeAsync(DELAY);
    expect(handler).toHaveBeenCalledOnce();
    handler.mockClear();

    (syncA.target as MemoryTarget).fails = true;
    const syncB = await getTestSync({ value: "B" });
    await settle(manager.addSync(syncB));

    await vi.advanceTimersByTimeAsync(DELAY);
    expect(handler).toHaveBeenCalledOnce();
});

test("Correctly recovers from desyncs by calling conflict handler", async () => {
    const resolveConflictingSyncsUpdate = vi.fn();
    resolveConflictingSyncsUpdate.mockImplementation(() => "D");

    const syncA = await getTestSync({ value: "A" });
    const syncB = await getTestSync({ value: "A" });
    const syncC = await getTestSync({ value: "A" });
    const manager = await getTestManager([syncA, syncB, syncC], { resolveConflictingSyncsUpdate });

    await settle(writeToAndUpdateSync(() => noop, { ...syncA }, "A"));
    await settle(writeToAndUpdateSync(() => noop, { ...syncB }, "B"));
    (syncA.target as MemoryTarget).fails = true;
    (syncB.target as MemoryTarget).fails = true;

    await settle(manager.setValue("C"));
    expect(syncA.missedWrite).toBe(true);
    expect(syncB.missedWrite).toBe(true);

    expect(resolveConflictingSyncsUpdate).not.toHaveBeenCalled();
    (syncA.target as MemoryTarget).fails = false;
    (syncB.target as MemoryTarget).fails = false;
    await settle(manager.poll());

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

    await settle(writeToAndUpdateSync(() => noop, { ...syncA }, "B"));
    (syncA.target as MemoryTarget).fails = true;

    await settle(manager.setValue("B"));
    expect(syncA.missedWrite).toBe(true);

    expect(resolveConflictingSyncsUpdate).not.toHaveBeenCalled();
    (syncA.target as MemoryTarget).fails = false;
    await settle(manager.poll());

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
    await settle(manager.poll());

    expect(logger).toHaveBeenCalledTimes(6);
    expect(logger).toHaveBeenCalledWith({ operation: "POLL", stage: "START", sync: syncA });
    expect(logger).toHaveBeenCalledWith({ operation: "POLL", stage: "SUCCESS", sync: syncA });
    expect(logger).toHaveBeenCalledWith({ operation: "POLL", stage: "START", sync: syncB });
    expect(logger).toHaveBeenCalledWith({ operation: "POLL", stage: "SUCCESS", sync: syncB });
    expect(logger).toHaveBeenCalledWith({ operation: "DOWNLOAD", stage: "START", sync: syncB });
    expect(logger).toHaveBeenCalledWith({ operation: "DOWNLOAD", stage: "SUCCESS", sync: syncB });
    logger.mockClear();

    await settle(manager.setValue("B"));

    // Each sync is checked before it is written to
    expect(logger).toHaveBeenCalledTimes(8);
    expect(logger).toHaveBeenCalledWith({ operation: "POLL", stage: "START", sync: syncA });
    expect(logger).toHaveBeenCalledWith({ operation: "POLL", stage: "SUCCESS", sync: syncA });
    expect(logger).toHaveBeenCalledWith({ operation: "POLL", stage: "START", sync: syncB });
    expect(logger).toHaveBeenCalledWith({ operation: "POLL", stage: "SUCCESS", sync: syncB });
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
    await vi.advanceTimersByTimeAsync(DELAY * 1.5);

    await settle(
        Promise.all([manager.poll(), manager.setValue("B"), manager.addSync(syncC), manager.removeSync(syncB)])
    );

    expect(await value(syncA)).toBe("D");
    expect(await value(syncB)).toBe("A"); // Removals before additions
    expect(await value(syncC)).toBe("D");
    expect(manager.getSyncsState()).toEqual([syncA, syncC]);
});

test("Writes to empty syncs with fallback values", async () => {
    const syncA = await getTestSync();
    const syncB = await getTestSync({ fails: true });
    await getTestManager([syncA, syncB]);
    await vi.advanceTimersByTimeAsync(DELAY); // The write is queued once the manager exists, and checks the sync first

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

    // Broadcasting arrives in its own time, and B's write, refused because A's landed first, is made again
    await vi.waitFor(() => {
        expect(managerA.getValue()).toBe("C");
        expect(managerB.getValue()).toBe("C");
    });
    await vi.waitFor(async () => expect(await value(sync)).toBe("C"));
});

/**
 * B checks the target before A's write lands, and writes after it. B's write used to go straight over
 * A's, which B had never seen. It is refused instead, and B's conflict handler decides, having read A's.
 */
test("Doesn't write over another manager's save to the same target, without broadcast", async () => {
    const resolveConflictingSyncsUpdate = vi.fn(async (local: string) => local);

    const sync = await getTestSync({ value: "A", delay: DELAY });
    const managerA = await getTestManager([sync], { resolveConflictingSyncsUpdate });
    const managerB = await getTestManager([{ ...sync }], { resolveConflictingSyncsUpdate });

    managerA.setValue("B");
    await vi.advanceTimersByTimeAsync(DELAY * 0.2);
    managerB.setValue("C");

    // Each step takes the target's delay. A's check and write land after 1 and 2; B's check after 1.2,
    // its refused write after 2.2, then its poll's check and read after 3.2 and 4.2.
    await vi.advanceTimersByTimeAsync(DELAY * 4.5);
    expect(resolveConflictingSyncsUpdate).toHaveBeenCalledWith("C", expect.anything(), [
        { sync: expect.anything(), value: expect.objectContaining({ value: "B" }) },
    ]);

    // B's handler kept its own value, which it writes over A's knowingly
    await vi.advanceTimersByTimeAsync(DELAY);
    expect(await value(sync)).toBe("C");
    expect(managerA.getValue()).toBe("B");

    // Only the target has moved on since A last saw it, so A takes B's value without asking
    await settle(managerA.poll());
    expect(managerA.getValue()).toBe("C");
    expect(resolveConflictingSyncsUpdate).toHaveBeenCalledOnce();
});

test("Handles poll soon after new value from broadcast", async () => {
    const id = "poll-after-broadcast";

    const sync = await getTestSync({ value: "A" });
    const managerA = await getTestManager([sync], { id });
    const managerB = await getTestManager([{ ...sync }], { id, ignoreDuplicateCheck: true });

    (sync.target as MemoryTarget).delay = DELAY * 2;
    managerA.setValue("B");

    await vi.advanceTimersByTimeAsync(DELAY * 0.5);
    (sync.target as MemoryTarget).delay = 0;

    expect(await value(sync)).toBe("A");
    await vi.waitFor(() => expect(managerB.getValue()).toEqual("B"));
    await settle(managerB.poll());
    expect(managerB.getValue()).toEqual("B");
    expect(await value(sync)).toBe("A");

    await vi.advanceTimersByTimeAsync(DELAY * 2);

    expect(managerB.getValue()).toEqual("B");
    expect(await value(sync)).toBe("B");
    await settle(managerB.poll());
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
    await vi.advanceTimersByTimeAsync(DELAY);
    onValueUpdate.mockClear();

    manager.close();

    await settle(manager.setValue("B"));
    await vi.advanceTimersByTimeAsync(DELAY);
    expect(onValueUpdate).not.toHaveBeenCalled();
    expect(await value(sync)).toBe("A");

    // The duplicate check no longer trips, so a fresh manager can take the same id
    const replacement = await getTestManager([sync], { id: "closed-manager" });
    expect(replacement.getValue()).toBe("A");
    replacement.close();
});

/**
 * An operation that was already running when the manager closed still finishes. It used to save the
 * syncs it ended with, and could so put back a list the application had just cleared - a sync the
 * user had removed along with the rest of their data, say.
 */
test("Saves nothing about its syncs once closed, even from an operation that was running", async () => {
    const sync = await getTestSync({ value: "A", delay: DELAY });
    const saveSyncData = vi.fn();
    const onSyncStatesUpdate = vi.fn();

    const manager = await getTestManager([sync], { saveSyncData, onSyncStatesUpdate });
    await vi.advanceTimersByTimeAsync(DELAY * 3);
    saveSyncData.mockClear();
    onSyncStatesUpdate.mockClear();

    const saving = manager.setValue("B");
    await vi.advanceTimersByTimeAsync(DELAY * 0.5);
    manager.close();
    await settle(saving);
    await vi.advanceTimersByTimeAsync(DELAY * 3);

    expect(saveSyncData).not.toHaveBeenCalled();
    expect(onSyncStatesUpdate).not.toHaveBeenCalled();
});

test("Stops listening to other managers once closed", async () => {
    const onValueUpdate = vi.fn();

    const listener = await getTestManager([], { id: "shared-channel-id", onValueUpdate });
    const speaker = await getTestManager([], { id: "shared-channel-id", ignoreDuplicateCheck: true });
    await vi.advanceTimersByTimeAsync(DELAY);
    onValueUpdate.mockClear();

    listener.close();
    await settle(speaker.setValue("BROADCAST"));
    await vi.advanceTimersByTimeAsync(DELAY);

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

    await settle(manager.addTarget(conflicting.target, { compressed: false }));
    expect(errors).toHaveBeenCalled();

    await settle(manager.setValue("AFTER"));
    await vi.advanceTimersByTimeAsync(DELAY);
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

const rawBuffer = async (sync: Sync<MemoryTarget>) => (await settle(sync.target.read())).value?.buffer;

test("Takes a value another context saved while this one was reading", async () => {
    // Saved a second ago, and read just now
    const id = "saved-while-reading";
    const sync = await getTestSync({ value: "A", timestamp: new Date().valueOf() - 1000 });
    const manager = await getTestManager([sync], { id });

    // The other context's save landed after that one, but before this manager was created
    const channel = new PSMBroadcastChannel(id, new ListBuffer<string>(), DefaultDeserialisers, noop, noop);
    channel.sendNewValue({ value: "B", timestamp: new Date(new Date().valueOf() - 500) });

    await vi.waitFor(() => expect(manager.getValue()).toBe("B"));
    channel.close();
    manager.close();
});

test("Rejects creation when the initial value can't be made, and lets the id be used again", async () => {
    const config = { getDefaultSyncs: async () => [await getTestSync()], getSyncData: () => null, id: "failed-start" };

    await expect(
        settle(
            PersonalStorageManager.create<string>(() => {
                throw new Error("No initial value");
            }, config)
        )
    ).rejects.toThrow("No initial value");

    const { manager } = await settle(PersonalStorageManager.create("AFTER", config));
    expect(manager.getValue()).toBe("AFTER");
    manager.close();
});

test("Rejects creation when the handler for failed targets throws", async () => {
    await expect(
        getTestManager([await getTestSync({ fails: true })], {
            handleAllEmptyAndFailedSyncsOnStartup: async () => {
                throw new Error("Handler failed");
            },
        })
    ).rejects.toThrow("Handler failed");
});

test("Tries a cached creation again after one fails", async () => {
    const config = { getDefaultSyncs: async () => [await getTestSync()], getSyncData: () => null, id: "failed-cache" };

    await expect(
        settle(
            PersonalStorageManager.createWithCache<string>(async () => {
                throw new Error("No initial value");
            }, config)
        )
    ).rejects.toThrow();

    const { manager } = await settle(PersonalStorageManager.createWithCache("AFTER", config));
    expect(manager.getValue()).toBe("AFTER");
    manager.close();
});

test("Never writes over a value that won't decode, and says so", async () => {
    const onUnreadableValue = vi.fn();
    const corrupt = getCorruptSync();
    const before = await rawBuffer(corrupt);
    const working = await getTestSync({ value: "A" });

    const manager = await getTestManager([corrupt, working], { onUnreadableValue });
    await vi.waitFor(() => expect(onUnreadableValue).toHaveBeenCalled()); // Decoding takes its own time

    expect(manager.getValue()).toBe("A");
    expect(onUnreadableValue).toHaveBeenCalledWith(
        expect.objectContaining({ error: "CORRUPT_VALUE", buffer: before }),
        { type: "SYNC", sync: corrupt }
    );
    expect(manager.getSyncsState()[0].unreadable).toBe(true);

    const result = await settle(manager.setValue("B"));
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

    await settle(manager.setValue("B"));
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

    await vi.waitFor(() => expect(onUnreadableValue).toHaveBeenCalled());
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

// The same list is saved and sent to other contexts, neither of which has seen what this one has
test("Never saves or broadcasts what it last saw in a target", async () => {
    const manager = await getTestManager([await getTestSync({ value: "A" })]);

    expect(manager.getSyncsState()[0].lastSeenValueTimestamp).toBeInstanceOf(Date);
    expect(getConfigFromSyncs(manager.getSyncsState())).not.toContain("lastSeenValueTimestamp");
    manager.close();
});

test("Writes to a target again once a poll finds it empty", async () => {
    const corrupt = getCorruptSync();
    const manager = await getTestManager([corrupt]);
    expect(manager.getSyncsState()[0].unreadable).toBe(true);

    corrupt.target.value = null;
    await settle(manager.poll());

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
    await vi.advanceTimersByTimeAsync(DELAY);

    failing.target.fails = true;
    const result = await settle(manager.setValue("B"));

    expect(result.saved).toEqual([working]);
    expect(result.failed).toEqual([failing]);
    manager.close();
});

test("Hands out copies of its syncs with a save result", async () => {
    const manager = await getTestManager([await getTestSync({ value: "A" })]);
    await vi.advanceTimersByTimeAsync(DELAY);

    const result = await settle(manager.setValue("B"));
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

    const manager = await getTestManager([getCorruptSync()], {
        id,
        onUnreadableValue,
        validate: (value) => (value === "INVALID" ? "Not allowed" : null),
    });
    expect(onUnreadableValue).toHaveBeenCalledOnce();

    const channel = new PSMBroadcastChannel(id, new ListBuffer<string>(), DefaultDeserialisers, noop, noop);
    channel.sendNewValue({ value: "INVALID", timestamp: new Date() });
    await vi.waitFor(() => expect(onUnreadableValue).toHaveBeenCalledTimes(2));

    channel.sendNewValue({ value: "VALID", timestamp: new Date() });
    await vi.waitFor(() => expect(manager.getValue()).toBe("VALID"));
    await settle(manager.poll());

    channel.close();
    manager.close();
    error.mockRestore();
});

test("Reports an unreadable value once, until something writes over it", async () => {
    const onUnreadableValue = vi.fn();
    const corrupt = getCorruptSync();
    const manager = await getTestManager([corrupt, await getTestSync({ value: "A" })], { onUnreadableValue });
    await vi.waitFor(() => expect(onUnreadableValue).toHaveBeenCalled()); // Decoding takes its own time
    expect(onUnreadableValue).toHaveBeenCalledOnce();

    await settle(manager.poll());
    await settle(manager.poll());
    expect(onUnreadableValue).toHaveBeenCalledOnce();

    // Something else writes another value it can't use
    corrupt.target.value = { timestamp: new Date(Date.now() + 1000), buffer: new Uint8Array([4, 5, 6]).buffer };
    await settle(manager.poll());
    expect(onUnreadableValue).toHaveBeenCalledTimes(2);
    expect(manager.getSyncsState()[0].unreadable).toBe(true);

    manager.close();
});

test("Saves a value set during startup to every sync, alongside the write to an empty one", async () => {
    const full = await getTestSync({ value: "A" });
    const empty = await getTestSync({ delay: DELAY });
    const manager = await getTestManager([full, empty]);

    // Set while startup still waits on the empty sync, which it then queues a write to
    const result = await settle(manager.setValue("B"));

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
        const { manager, syncsSource } = await getTestCreation([sync], { getSyncData });
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

let id = 0;

/** Starts creating a manager, whose startup waits on its syncs' timers */
const startTestCreation = (
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
const startTestManager = async (...args: Parameters<typeof startTestCreation>) =>
    (await startTestCreation(...args)).manager;

const getTestCreation = (...args: Parameters<typeof startTestCreation>) => settle(startTestCreation(...args));
const getTestManager = (...args: Parameters<typeof startTestCreation>) => settle(startTestManager(...args));

const value = async (sync: Sync<MemoryTarget>) => (await settle(readFromSync(() => noop, sync))).value?.value;

test("Says on a later startup which target missed a write", async () => {
    const syncA = await getTestSync({ value: "A" });
    const syncB = await getTestSync({ value: "A" });
    const first = await getTestManager([syncA, syncB]);
    await vi.advanceTimersByTimeAsync(1);

    // Saved while one target could be reached and the other couldn't
    (syncB.target as MemoryTarget).fails = true;
    await settle(first.setValue("B"));
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
    await vi.advanceTimersByTimeAsync(DELAY);

    expect(seen).toEqual([
        ["B", false],
        ["A", true],
    ]);

    // Once it has the value, it no longer says so
    expect(second.getSyncsState().map(({ missedWrite }) => missedWrite)).toEqual([false, false]);
});

/**
 * Another device saves to a shared target while this manager is running with polling off. Its next
 * save used to go straight over that value, and the device's change was lost without anything ever
 * having read it. The target is checked first: the save goes to the targets nobody else has written
 * to, and the one that has moved on goes to the conflict handler, recorded as having missed this
 * manager's value - so that both copies are known to have changed.
 */
test("Doesn't write over a value saved elsewhere since, even with polling off", async () => {
    const local = await getTestSync({ value: "A", timestamp: 1000 });
    const shared = await getTestSync({ value: "A", timestamp: 1000 });

    let seen: { value: string; missedWrite: boolean }[] = [];
    const resolveConflictingSyncsUpdate: ConflictingRemoteBehaviour<string, DefaultTarget> = async (
        value,
        _,
        conflicts
    ) => {
        seen = conflicts.map(({ sync, value }) => ({ value: value.value, missedWrite: sync.missedWrite === true }));
        return value;
    };
    const manager = await getTestManager([local, shared], { resolveConflictingSyncsUpdate });
    await vi.advanceTimersByTimeAsync(1);

    // Another device's save, which nothing here has read
    await settle(shared.target.write(await getBufferFromValue("OTHER", false)));

    await settle(manager.setValue("B"));
    await vi.advanceTimersByTimeAsync(DELAY); // The poll it asks for runs at once

    expect(seen).toEqual([{ value: "OTHER", missedWrite: true }]);
    expect(await value(local)).toBe("B");
});

/**
 * The check before a write can't see a save that lands between it and the write. The write expects
 * the target still to hold what the check found, so the target refuses it, and the poll that follows
 * hands the other value to the conflict handler - with nothing written over it in the meantime.
 */
test("Doesn't write over a value saved between its check and its write", async () => {
    const handleSyncOperationLog = vi.fn();
    const sync = await getTestSync({ value: "A", delay: DELAY });
    const other = await getBufferFromValue("OTHER", false);

    // What the handler is shown, and whether the other value was still there to be shown
    let shown: { conflicts: string[]; untouched: boolean } | null = null;
    const resolveConflictingSyncsUpdate: ConflictingRemoteBehaviour<string, DefaultTarget> = async (
        local,
        _,
        conflicts
    ) => {
        shown = {
            conflicts: conflicts.map(({ value }) => value.value),
            untouched: sync.target.value?.buffer === other,
        };
        return local;
    };
    const manager = await getTestManager([sync], { handleSyncOperationLog, resolveConflictingSyncsUpdate });

    // The check is answered after the target's delay, and the write lands one delay later: another device saves in between
    manager.setValue("B");
    await vi.advanceTimersByTimeAsync(DELAY * 1.5);
    sync.target.value = { timestamp: new Date(), buffer: other };

    // The refused write lands after 2, and the poll's check and read after 3 and 4
    await vi.advanceTimersByTimeAsync(DELAY * 3);
    expect(handleSyncOperationLog).toHaveBeenCalledWith({ operation: "UPLOAD", stage: "CONFLICT", sync });
    expect(shown).toEqual({ conflicts: ["OTHER"], untouched: true });

    // The handler kept this manager's value, which is then written over the other, knowingly
    await vi.advanceTimersByTimeAsync(DELAY);
    expect(await value(sync)).toBe("B");
});
