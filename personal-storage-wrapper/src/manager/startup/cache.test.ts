import { expect, test, vi } from "vitest";
import { noop } from "../../utilities/data";
import { getTestSync } from "../utilities/test";
import { createPSMWithCache } from "./cache";

const DELAY = 20;

test("Returns and updates cache correctly", async () => {
    const store = await getTestSync();
    const createPSMObject = vi.fn().mockImplementation((_1, _2, _3, _4, _5) => ({ config: _5 }));

    const createPSMStubFromCache = async (id: string, handler: () => void) =>
        createPSMWithCache(createPSMObject, "A", {
            id,
            onValueUpdate: handler,
            defaultSyncStates: Promise.resolve([await getTestSync()]),
            getSyncData: () => null,
            saveSyncData: noop,
        });

    const handler1 = () => null;
    const manager1 = createPSMStubFromCache("cache-1", handler1);
    const handler2 = () => null;
    const manager2 = createPSMStubFromCache("cache-1", handler2);
    const handler3 = () => null;
    const manager3 = createPSMStubFromCache("cache-3", handler3);

    await Promise.all([manager1, manager2, manager3]);

    expect(await manager1).toBe(await manager2);
    expect(await manager1).not.toBe(await manager3);

    expect((await manager1).config.onValueUpdate).toBe(handler2);
    expect((await manager2).config.onValueUpdate).toBe(handler2);
    expect((await manager3).config.onValueUpdate).toBe(handler3);
});
