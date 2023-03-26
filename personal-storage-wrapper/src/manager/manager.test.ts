/**
 * @vitest-environment jsdom
 */

import { expect, test, vi } from "vitest";
import { PersonalStorageManager } from "./manager";

test("Can create a PSM correctly", async () => {
    const onSyncStatesUpdate = vi.fn();
    const manager = await PersonalStorageManager.create("VALUE", { onSyncStatesUpdate });
    expect(manager.getValue()).toBe("VALUE");
    expect(onSyncStatesUpdate).toHaveBeenCalledOnce();
});
