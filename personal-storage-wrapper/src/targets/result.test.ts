import { expect, test } from "vitest";
import { Result } from "./result";

const DELAY = 10;

test("Correctly initialises for resolve and reject", async () => {
    expect(await Result.value(7)).toEqual({ type: "value", value: 7 });
    expect(await Result.error("OFFLINE")).toEqual({ type: "error", error: "OFFLINE" });
    expect(await new Result((resolve) => resolve({ type: "value", value: 7 }))).toEqual({ type: "value", value: 7 });

    expect(await new Result((_resolve, reject) => reject())).toEqual({ type: "error", error: "UNKNOWN" });
});

test("Correctly handles maps", async () => {
    expect(await Result.value(7).map((x) => x + 1)).toEqual({ type: "value", value: 8 });
    expect(await Result.error("OFFLINE").map(() => 8)).toEqual({ type: "error", error: "OFFLINE" });
});

test("Correctly handles flatmaps", async () => {
    expect(await Result.value(7).flatmap((x) => Result.value(x + 1))).toEqual({ type: "value", value: 8 });
    expect(await Result.error("OFFLINE").flatmap(() => Result.value(8))).toEqual({ type: "error", error: "OFFLINE" });
});

test("Result.rall waits for all results", async () => {
    const start = new Date();
    expect(await Result.rall([slowValue(7, DELAY), Result.value(8)])).toEqual({ type: "value", value: [7, 8] });
    expect(new Date().valueOf() - start.valueOf()).toBeGreaterThanOrEqual(DELAY - 1);
});

test("Result.rall fails quickly given an error", async () => {
    const start = new Date();
    expect(await Result.rall([slowValue(7, DELAY), Result.error("OFFLINE")])).toEqual({
        type: "error",
        error: "OFFLINE",
    });
    expect(new Date().valueOf() - start.valueOf()).toBeLessThan(DELAY - 1);
});

test("Result.rany gives the first result without waiting ", async () => {
    const start = new Date();
    expect(await Result.rany([slowValue(7, DELAY), Result.value(8)])).toEqual({ type: "value", value: 8 });
    expect(new Date().valueOf() - start.valueOf()).toBeLessThan(DELAY - 1);
});

test("Result.rall waits for first success", async () => {
    const start = new Date();
    expect(await Result.rany([slowValue(7, DELAY), Result.error("OFFLINE")])).toEqual({ type: "value", value: 7 });
    expect(new Date().valueOf() - start.valueOf()).toBeGreaterThanOrEqual(DELAY - 1);
});

test("Result.rall returns failures correctly", async () => {
    const start = new Date();
    expect(await Result.rany([Result.error("OFFLINE"), slowError(DELAY)])).toEqual({ type: "error", error: "OFFLINE" });
    expect(new Date().valueOf() - start.valueOf()).toBeGreaterThanOrEqual(DELAY - 1);
});

test("Result.flatten correctly returns", async () => {
    const test = {
        a: 1,
        b: Result.value(2),
        c: [3],
        d: [Result.value(4)],
        e: {
            f: 6,
            g: Result.value(7),
            h: [8],
            i: [Result.value(9)],
        },
        j: Result.value([10]),
        k: Result.value({
            l: Result.value(12),
        }),
        m: Result.value([Result.value(13)]),
    };
    const result: Result<{
        a: number;
        b: number;
        c: number[];
        d: number[];
        e: {
            f: number;
            g: number;
            h: number[];
            i: number[];
        };
        j: number[];
        k: {
            l: number;
        };
        m: number[];
    }> = Result.flatten(test);

    expect(await result).toEqual({
        type: "value",
        value: {
            a: 1,
            b: 2,
            c: [3],
            d: [4],
            e: {
                f: 6,
                g: 7,
                h: [8],
                i: [9],
            },
            j: [10],
            k: {
                l: 12,
            },
            m: [13],
        },
    });
});

test("Result.flatten errors quickly", async () => {
    const start = new Date();
    const test = { a: 1, b: slowValue(1, DELAY), c: { d: Result.error("OFFLINE") } };
    expect(await Result.flatten(test)).toEqual({ type: "error", error: "OFFLINE" });
    expect(new Date().valueOf() - start.valueOf()).toBeLessThan(DELAY - 1);
});

test("Result.suppress suppresses correctly", async () => {
    const value = Result.value(7);
    const error = Result.error("EXPIRED_AUTH");
    expect(await value.supress("EXPIRED_AUTH", 8)).toEqual({ type: "value", value: 7 });
    expect(await error.supress("EXPIRED_AUTH", 8)).toEqual({ type: "value", value: 8 });
    expect(await error.supress("UNKNOWN", 8)).toEqual({ type: "error", error: "EXPIRED_AUTH" });
});

/**
 * Utilities
 */

const slowValue = <T>(value: T, delay: number) =>
    new Result<T>((resolve) => setTimeout(() => resolve({ type: "value", value }), delay));

const slowError = (delay: number) =>
    new Result((resolve) => setTimeout(() => resolve({ type: "error", error: "OFFLINE" }), delay));
