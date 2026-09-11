/**
 * @vitest-environment jsdom
 */

import "fake-indexeddb/auto";
import { expect, test, vi } from "vitest";
import { encodeTextToBuffer } from "../../utilities/buffers";
import { MemoryTarget } from "../memory";
import { IndexedDBTarget } from "./target";

const TEST_BUFFER = await encodeTextToBuffer("Hello, World!", false);

/**
 * `create` used to resolve out of `onupgradeneeded`, before the transaction that creates the object
 * store had finished, so the first read of a database that did not exist yet threw an
 * InvalidStateError - which the library turned into a promise nobody was waiting on. Every test
 * here used to need an artificial wait before it to work around that.
 */
test("Can be read from as soon as it is created", async () => {
    const target = await IndexedDBTarget.create("created-just-now");

    expect(await target.read()).toEqual({ type: "value", value: null });
});

test("Correctly handles empty states", async () => {
    const target = (await IndexedDBTarget.create())!;
    expect(target.online()).toBe(true);

    const result = await target.read();
    expect(result.value).toBeNull();
});

test("Correctly handles basic storage and retrieval", async () => {
    const target = await IndexedDBTarget.create();
    expect(target).not.toBeNull();

    const result = await target!.write(TEST_BUFFER);
    const read = await target!.read();

    expect(read.value?.buffer).toEqual(TEST_BUFFER);
    expect(result.value).toEqual(read.value?.timestamp);
});

test("Can store multiple values without overrides", async () => {
    const targetA = (await IndexedDBTarget.create())!;
    const targetB = (await IndexedDBTarget.create())!;

    const test1 = await encodeTextToBuffer("Test 1", false);
    const test2 = await encodeTextToBuffer("Test 2", false);

    await targetA.write(test1);
    await targetB.write(test2);

    const result1 = await targetA.read();
    const result2 = await targetB.read();

    expect(result1.value?.buffer).toEqual(test1);
    expect(result2.value?.buffer).toEqual(test2);
});

test("Correctly serialises and retains values", async () => {
    const target = (await IndexedDBTarget.create())!;
    await target.write(TEST_BUFFER);

    const config = JSON.stringify(target.serialise());
    const newTarget = await IndexedDBTarget.deserialise(JSON.parse(config));
    expect(newTarget).not.toBeNull();

    const read = await newTarget!.read();
    expect(read.value?.buffer).toEqual(TEST_BUFFER);
});

test("Correctly checks for equality", async () => {
    const idb1 = await IndexedDBTarget.create("equality-id1");
    const idb2 = await IndexedDBTarget.create("equality-id1");
    const idb3 = await IndexedDBTarget.create("equality-id3");
    const memory = new MemoryTarget();

    expect(idb1.equals(idb1)).toBe(true);
    expect(idb1.equals(idb2)).toBe(true);
    expect(idb1.equals(idb3)).toBe(false);
    expect(idb1.equals(memory)).toBe(false);
});

/**
 * A held-open connection blocks another tab (or a test teardown) from deleting or upgrading the
 * database, and the block never lifts on its own. Letting go on `versionchange` means the delete
 * goes through, and the target answers OFFLINE from then on rather than throwing.
 */
test("Lets go of its connection so that another tab can delete the database", async () => {
    const target = await IndexedDBTarget.create("version-change-id");
    await target.write(TEST_BUFFER);

    const deleted = new Promise<string>((resolve) => {
        const request = indexedDB.deleteDatabase("personal-storage-wrapper");
        request.onsuccess = () => resolve("deleted");
        request.onblocked = () => resolve("blocked");
        request.onerror = () => resolve("errored");
    });

    expect(await deleted).toBe("deleted");
    expect(await target.write(TEST_BUFFER)).toEqual({ type: "error", error: "OFFLINE" });
    expect(await target.read()).toEqual({ type: "error", error: "OFFLINE" });
});

test("Returns a target that is offline when the database cannot be opened at all", async () => {
    const open = window.indexedDB.open;
    window.indexedDB.open = () => {
        throw new Error("Access to storage is not allowed from this context.");
    };

    try {
        const target = await IndexedDBTarget.create("private-mode-id");
        expect(await target.write(TEST_BUFFER)).toEqual({ type: "error", error: "OFFLINE" });
    } finally {
        window.indexedDB.open = open;
    }
});

test("Does not describe a failed request on an open database as offline", async () => {
    const target = await IndexedDBTarget.create("failed-request-id");
    const request = {} as IDBRequest;
    const objectStore = { get: vi.fn(() => request), put: vi.fn(() => request) };
    const transaction = vi.fn(() => ({ objectStore: () => objectStore }));
    (target as unknown as { db: Pick<IDBDatabase, "transaction"> }).db = { transaction };

    const read = target.read();
    request.onerror?.(new Event("error"));
    expect(await read).toEqual({ type: "error", error: "UNKNOWN", detail: undefined });

    const write = target.write(TEST_BUFFER);
    request.onerror?.(new Event("error"));
    expect(await write).toEqual({ type: "error", error: "UNKNOWN", detail: undefined });
});

/**
 * A version change transaction that is interrupted leaves the version number behind without the
 * store it was creating, and `onupgradeneeded` never runs again for a version already seen - so
 * every read and write failed from then on, for as long as the browser held the database.
 */
test("Repairs a database left at the current version without its store", async () => {
    await new Promise<void>((resolve, reject) => {
        const request = indexedDB.open("personal-storage-wrapper", 1);
        request.onupgradeneeded = () => undefined; // The interrupted upgrade: no store created
        request.onsuccess = () => {
            request.result.close();
            resolve();
        };
        request.onerror = () => reject(request.error);
    });

    const target = await IndexedDBTarget.create("tophat");

    expect(await target.write(TEST_BUFFER)).toMatchObject({ type: "value" });
    expect((await target.read()).value).not.toBe(null);
    target.close();

    // Repairing it moves the version on, and the next session has to open that rather than fail
    const reopened = await IndexedDBTarget.create("tophat");
    expect((await reopened.read()).value).not.toBe(null);
});
