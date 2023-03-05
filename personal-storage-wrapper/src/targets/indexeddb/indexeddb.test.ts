/**
 * @vitest-environment jsdom
 */

import "fake-indexeddb/auto";
import { expect, test } from "vitest";
import { IndexedDBTarget, IndexedDBTargetDeserialiser } from ".";
import { encodeTextToBuffer } from "../../utilities/buffers";

const TEST_BUFFER = await encodeTextToBuffer("Hello, World!");

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

    const test1 = await encodeTextToBuffer("Test 1");
    const test2 = await encodeTextToBuffer("Test 2");

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
    const newTarget = await IndexedDBTargetDeserialiser(JSON.parse(config));
    expect(newTarget).not.toBeNull();

    const read = await newTarget!.read();
    expect(read.value?.buffer).toEqual(TEST_BUFFER);
});
