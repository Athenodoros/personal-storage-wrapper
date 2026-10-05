import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { DELAY, expectToSettleAfter, settle } from "../manager/utilities/test";
import { Result } from "./result";

beforeEach(() => void vi.useFakeTimers());
afterEach(() => void vi.useRealTimers());

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
    const combined = Result.rall([slowValue(7, DELAY), Result.value(8)]);
    const result = await expectToSettleAfter(combined, DELAY);
    expect(result).toEqual({ type: "value", value: [7, 8] });
});

test("Result.rall fails quickly given an error", async () => {
    const combined = Result.rall([slowValue(7, DELAY), Result.error("OFFLINE")]);
    const result = await expectToSettleAfter(combined, 0);
    expect(result).toEqual({ type: "error", error: "OFFLINE" });
});

test("Result.rany gives the first result without waiting ", async () => {
    const combined = Result.rany([slowValue(7, DELAY), Result.value(8)]);
    const result = await expectToSettleAfter(combined, 0);
    expect(result).toEqual({ type: "value", value: 8 });
});

test("Result.rall waits for first success", async () => {
    const combined = Result.rany([slowValue(7, DELAY), Result.error("OFFLINE")]);
    const result = await expectToSettleAfter(combined, DELAY);
    expect(result).toEqual({ type: "value", value: 7 });
});

test("Result.rall returns failures correctly", async () => {
    const combined = Result.rany([Result.error("OFFLINE"), slowError(DELAY)]);
    const result = await expectToSettleAfter(combined, DELAY);
    expect(result).toEqual({ type: "error", error: "OFFLINE" });
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
    const test = { a: 1, b: slowValue(1, DELAY), c: { d: Result.error("OFFLINE") } };
    const result = await expectToSettleAfter(Result.flatten(test), 0);
    expect(result).toEqual({ type: "error", error: "OFFLINE" });
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

test("Turns a synchronous throw into an error rather than a rejection, and says what was thrown", async () => {
    const result = await new Result(() => {
        throw new Error("Something the browser refused to do");
    });

    expect(result).toEqual({ type: "error", error: "UNKNOWN", detail: "Something the browser refused to do" });
});

/**
 * An async executor's throw rejects the promise the executor returns, not the Result, so it used to
 * be lost: a `fetch` that failed while a Dropbox token was refreshed left every request behind it,
 * and the manager's whole operation queue, waiting for good.
 */
test("Turns a throw in an async executor into an error rather than never returning", async () => {
    const result = new Result(async () => {
        await Promise.resolve();
        throw new TypeError("Failed to fetch");
    });

    expect(await settle(result)).toEqual({ type: "error", error: "UNKNOWN", detail: "Failed to fetch" });
});

test("Turns a rejecting map callback into an error rather than never returning", async () => {
    const mapped = Result.value(7).map(() => {
        throw new Error("Not the file that was expected");
    });
    const pmapped = Result.value(7).pmap(async () => {
        throw new Error("Not the file that was expected");
    });
    const flatmapped = Result.value(7).flatmap(() => {
        throw new Error("Not the file that was expected");
    });

    const thrown = { type: "error", error: "UNKNOWN", detail: "Not the file that was expected" };
    expect(await settle(mapped)).toEqual(thrown);
    expect(await settle(pmapped)).toEqual(thrown);
    expect(await settle(flatmapped)).toEqual(thrown);
});
