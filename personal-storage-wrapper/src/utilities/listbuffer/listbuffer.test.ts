import { expect, test } from "vitest";
import { ListBuffer } from ".";

test("Correctly handles maximum length", () => {
    const buffer = new ListBuffer([2, 3, 4], { maxLength: 2 });
    expect(buffer.values()).toEqual([2, 3]);

    buffer.push(5);
    expect(buffer.values()).toEqual([5, 2]);
});

test("Correctly handles maximum duration", async () => {
    const buffer = new ListBuffer([2, 3, 4], { maxMillis: 30 });
    expect(buffer.values()).toEqual([2, 3, 4]);

    await wait(10);
    buffer.push(5);
    buffer.push(6);
    expect(buffer.values()).toEqual([6, 5, 2, 3, 4]);

    await wait(30);
    expect(buffer.values()).toEqual([6, 5]);

    await wait(30);
    expect(buffer.values()).toEqual([]);
});

test("Correctly handles maximum duration and length", async () => {
    const buffer = new ListBuffer([2, 3, 4], { maxMillis: 30, maxLength: 2 });
    expect(buffer.values()).toEqual([2, 3]);

    await wait(10);
    buffer.push(5);
    expect(buffer.values()).toEqual([5, 2]);

    await wait(30);
    expect(buffer.values()).toEqual([5]);

    await wait(30);
    expect(buffer.values()).toEqual([]);
});

const wait = (millis: number) => new Promise<void>((resolve) => setTimeout(() => resolve(), millis));
