import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { ListBuffer } from ".";

const DELAY = 40;

// A fake clock, so that these check when values may be dropped rather than how promptly timers fire
beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
});
afterEach(() => {
    vi.useRealTimers();
});

test("Correctly handles maximum length", () => {
    const buffer = new ListBuffer([2, 3, 4], { maxLength: 2 });
    expect(buffer.values()).toEqual([2, 3]);

    buffer.push(5);
    expect(buffer.values()).toEqual([5, 2]);

    // However many are added at once
    buffer.push(6, 7, 8);
    expect(buffer.values()).toEqual([6, 7]);
});

test("Correctly handles maximum duration", () => {
    const buffer = new ListBuffer([2, 3, 4], { maxMillis: DELAY });
    expect(buffer.values()).toEqual([2, 3, 4]);

    vi.advanceTimersByTime(DELAY * 0.5);
    buffer.push(5);
    buffer.push(6);
    expect(buffer.values()).toEqual([6, 5, 2, 3, 4]);

    // Every value is kept for at least the maximum duration
    vi.advanceTimersByTime(DELAY * 0.5 - 1);
    expect(buffer.values()).toEqual([6, 5, 2, 3, 4]);

    vi.advanceTimersByTime(1);
    expect(buffer.values()).toEqual([6, 5]);

    vi.advanceTimersByTime(DELAY);
    expect(buffer.values()).toEqual([]);
});

test("Correctly handles maximum duration and length", () => {
    const buffer = new ListBuffer([2, 3, 4], { maxMillis: DELAY, maxLength: 2 });
    expect(buffer.values()).toEqual([2, 3]);

    vi.advanceTimersByTime(DELAY * 0.5);
    buffer.push(5);
    expect(buffer.values()).toEqual([5, 2]);

    vi.advanceTimersByTime(DELAY * 0.5);
    expect(buffer.values()).toEqual([5]);

    vi.advanceTimersByTime(DELAY);
    expect(buffer.values()).toEqual([]);
});
