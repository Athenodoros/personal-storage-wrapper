import { expect, test } from "vitest";
import { encodeTextToBuffer } from "../../utilities/buffers";
import { MemoryTarget } from "./target";

const TEST_BUFFER = await encodeTextToBuffer("Hello, World!");
const TEST_TIME_TOLERANCE_MILLIS = 2;

test("Correctly handles empty states", async () => {
    const result = await new MemoryTarget().read();
    expect(result.value).toEqual(null);
});

test("Correctly handles basic storage and retrieval", async () => {
    const DELAY_MILLIS = 50;

    const target = new MemoryTarget([DELAY_MILLIS]);
    const start = new Date().valueOf();

    const result = await target.write(TEST_BUFFER);
    const read = await target.read();

    expect(read.value?.buffer).toEqual(TEST_BUFFER);
    expect(start + DELAY_MILLIS - TEST_TIME_TOLERANCE_MILLIS).lessThanOrEqual(result.value?.valueOf() ?? 0);
    expect(result.value).toEqual(read.value?.timestamp);
});

test("Can store multiple values without overrides", async () => {
    const targetA = new MemoryTarget();
    const targetB = new MemoryTarget();

    const test1 = await encodeTextToBuffer("Test 1");
    const test2 = await encodeTextToBuffer("Test 2");

    await targetA.write(test1);
    await targetB.write(test2);

    const result1 = await targetA.read();
    const result2 = await targetB.read();

    expect(result1.value?.buffer).toEqual(test1);
    expect(result2.value?.buffer).toEqual(test2);
});

test("Correctly serialises for resetting targets", async () => {
    const target = new MemoryTarget();
    await target.write(TEST_BUFFER);

    const config = JSON.stringify(target.serialise());
    const newTarget = await MemoryTarget.deserialise(JSON.parse(config));
    expect(newTarget).not.toBeNull();

    const read = await newTarget!.read();
    expect(read.value).toBeNull();
});

test("Correctly serialises for preserving targets", async () => {
    const target = new MemoryTarget([0], true);
    await target.write(TEST_BUFFER);

    const config = JSON.stringify(target.serialise());
    const newTarget = await MemoryTarget.deserialise(JSON.parse(config));
    expect(newTarget).not.toBeNull();

    const read = await newTarget!.read();
    expect(read.value?.buffer).toEqual(TEST_BUFFER);
});
