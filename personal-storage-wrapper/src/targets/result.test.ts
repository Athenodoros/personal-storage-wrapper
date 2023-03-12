import { expect, test } from "vitest";
import { Result } from "./result";

const DELAY = 10;

test("Correctly initialises for resolve and reject", async () => {
    expect(await Result.value(7)).toEqual({ type: "value", value: 7 });
    expect(await Result.error()).toEqual({ type: "error" });
    expect(await new Result((resolve) => resolve({ type: "value", value: 7 }))).toEqual({ type: "value", value: 7 });

    expect(await new Result((resolve, reject) => reject())).toEqual({ type: "error" });
});

test("Correctly handles maps", async () => {
    expect(await Result.value(7).map((x) => x + 1)).toEqual({ type: "value", value: 8 });
    expect(await Result.error().map(() => 8)).toEqual({ type: "error" });
});

test("Correctly handles flatmaps", async () => {
    expect(await Result.value(7).flatmap((x) => Result.value(x + 1))).toEqual({ type: "value", value: 8 });
    expect(await Result.error().flatmap((x) => Result.value(8))).toEqual({ type: "error" });
});

test("Result.rall waits for all results", async () => {
    const start1 = new Date();
    expect(await Result.rall([slowValue(7, DELAY), Result.value(8)])).toEqual({ type: "value", value: [7, 8] });
    expect(new Date().valueOf() - start1.valueOf()).toBeGreaterThanOrEqual(DELAY - 1);
});

test("Result.rall fails quickly given an error", async () => {
    const start2 = new Date();
    expect(await Result.rall([slowValue(7, DELAY), Result.error()])).toEqual({ type: "error" });
    expect(new Date().valueOf() - start2.valueOf()).toBeLessThan(DELAY - 1);
});

test("Result.rany gives the first result without waiting ", async () => {
    const start1 = new Date();
    expect(await Result.rany([slowValue(7, DELAY), Result.value(8)])).toEqual({ type: "value", value: 8 });
    expect(new Date().valueOf() - start1.valueOf()).toBeLessThan(DELAY - 1);
});

test("Result.rall waits for first success", async () => {
    const start2 = new Date();
    expect(await Result.rany([slowValue(7, DELAY), Result.error()])).toEqual({ type: "value", value: 7 });
    expect(new Date().valueOf() - start2.valueOf()).toBeGreaterThanOrEqual(DELAY - 1);
});

test("Result.rall returns failures correctly", async () => {
    const start3 = new Date();
    expect(await Result.rany([Result.error(), slowError(DELAY)])).toEqual({ type: "error" });
    expect(new Date().valueOf() - start3.valueOf()).toBeGreaterThanOrEqual(DELAY - 1);
});

/**
 * Utilities
 */

const slowValue = <T>(value: T, delay: number) =>
    new Result<T>((resolve) => setTimeout(() => resolve({ type: "value", value }), delay));

const slowError = (delay: number) => new Result((resolve) => setTimeout(() => resolve({ type: "error" }), delay));
