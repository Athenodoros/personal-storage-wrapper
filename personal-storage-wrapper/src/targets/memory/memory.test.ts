/**
 * @vitest-environment jsdom
 */

import { expect, test } from "vitest";
import { compress, decompress } from "../../utilities/buffers/compression";
import { decodeFromArrayBuffer, encodeToArrayBuffer } from "../../utilities/buffers/encoding";
import { MemoryTarget } from "./target";

const TEST_STRING = "Hello, World!";
const TEST_TIME_TOLERANCE_MILLIS = 2;

test("Correctly handles empty states", async () => {
    const target = new MemoryTarget();
    expect(target.online()).toBe(true);

    const result = await target.read();
    expect(result.value).toEqual(null);
});

test("Correctly fails", async () => {
    const target = new MemoryTarget({ fails: true });
    expect(target.online()).toBe(false);

    const result = await target.read();
    expect(result.type).toEqual("error");
});

test("Correctly handles basic storage and retrieval", async () => {
    const DELAY_MILLIS = 50;

    const target = new MemoryTarget({ delay: DELAY_MILLIS });
    const start = new Date().valueOf();

    const result = await target.write(encodeToArrayBuffer(TEST_STRING));
    const read = await target.read();

    expect(decodeFromArrayBuffer(read.value!.buffer)).toEqual(TEST_STRING);
    expect(start + DELAY_MILLIS - TEST_TIME_TOLERANCE_MILLIS).lessThanOrEqual(result.value?.valueOf() ?? 0);
    expect(result.value).toEqual(read.value?.timestamp);
});

test("Can store multiple values without overrides", async () => {
    const targetA = new MemoryTarget();
    const targetB = new MemoryTarget();

    const test1 = "Test 1";
    const test2 = "Test 2";

    await targetA.write(encodeToArrayBuffer(test1));
    await targetB.write(encodeToArrayBuffer(test2));

    const result1 = await targetA.read();
    const result2 = await targetB.read();

    expect(decodeFromArrayBuffer(result1.value!.buffer)).toEqual(test1);
    expect(decodeFromArrayBuffer(result2.value!.buffer)).toEqual(test2);
});

test("Correctly serialises for resetting targets", async () => {
    const target = new MemoryTarget({ preserveValueOnSave: false });
    await target.write(encodeToArrayBuffer(TEST_STRING));

    const config = JSON.stringify(target.serialise());
    const newTarget = MemoryTarget.deserialise(JSON.parse(config));
    expect(newTarget).not.toBeNull();

    const read = await newTarget!.read();
    expect(read.value).toBeNull();
});

test("Correctly serialises for preserving targets", async () => {
    const target = new MemoryTarget({ preserveValueOnSave: true });
    await target.write(await compress(TEST_STRING));

    const config = JSON.stringify(target.serialise());
    const newTarget = MemoryTarget.deserialise(JSON.parse(config));
    expect(newTarget).not.toBeNull();

    const read = await newTarget!.read();
    expect(await decompress(read.value?.buffer!)).toStrictEqual(TEST_STRING);
});

test("Correctly checks for equality", async () => {
    const memory1 = new MemoryTarget();
    const memory2 = new MemoryTarget();
    const dummy = {};

    expect(memory1.equals(memory1)).toBe(true);
    expect(memory1.equals(memory2)).toBe(false);
    expect(memory1.equals(dummy as any)).toBe(false);
});
