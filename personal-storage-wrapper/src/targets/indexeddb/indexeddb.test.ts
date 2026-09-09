/**
 * @vitest-environment jsdom
 */

import "fake-indexeddb/auto";
import { expect, test } from "vitest";
import { encodeTextToBuffer } from "../../utilities/buffers";
import { MemoryTarget } from "../memory";
import { IndexedDBTarget } from "./target";

const TEST_BUFFER = await encodeTextToBuffer("Hello, World!", false);

/**
 * jsdom's IDB implementation seems to take time to become available after returning the db instance
 * Without this artifical wait, otherwise the first test to run will throw an InvalidStateError
 */
await IndexedDBTarget.create();
await new Promise<void>((resolve) => setTimeout(() => resolve(), 5));

/**
 * Now the actual tests
 */
test("Correctly handles empty states", async () => {
    const target = (await IndexedDBTarget.create())!;
    expect(target.online()).toBe(true);

    const result = await target.read();
    expect(result.value).toBeNull();
});

test("Correctly handles basic storage and retrieval", async () => {
    const target = await IndexedDBTarget.create();
    await new Promise<void>((resolve) => setTimeout(() => resolve(), 10));
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
