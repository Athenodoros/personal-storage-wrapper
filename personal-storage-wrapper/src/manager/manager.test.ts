/**
 * @vitest-environment jsdom
 */

import { expect, test, vi } from "vitest";
import { PersonalStorageManager } from "./manager";

test("Can create a PSM correctly", async () => {
    const onSyncStatesUpdate = vi.fn();
    const manager = await PersonalStorageManager.create("VALUE", { onSyncStatesUpdate, pollPeriodInSeconds: null });
    expect(manager.getValue()).toBe("VALUE");
    expect(onSyncStatesUpdate).toHaveBeenCalledOnce();
});

// Startup
//      Handles conflicting local and remote syncs on startup
//      Handles operations during startup and returns promise to actioned result

// Basic Operations
//      Updates state immediately in callback, pushes async, and broadcasts to channel
//      Successfully adds a sync and pushes to channel
//      Successfully removes a sync and pushes to channel
//      Successfully updates syncs from channel
//      Successfully updates values from channel
//      Successfully polls on manual trigger
//      Polls for changes on schedule and updates to remote values
//      Successfully writes to synced syncs

// Compound Tests
//      Calls onSyncsUpdate once with multiple changes (eg. add sync and desync another one)
//      Correctly recovers from desyncs by calling handler
//      Correctly recovers from descyncs without calling handler
//      Correctly logs during read/write cycle
//      Correctly handles new value during operation, then queued addition/removal operations
