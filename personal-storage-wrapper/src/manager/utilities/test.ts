import { expect, vi } from "vitest";
import { DropboxTarget } from "../../targets";
import { MemoryTarget } from "../../targets/memory";
import { Sync, Value } from "../types";
import { getBufferFromValue } from "../utilities/serialisation";

/**
 * Fake timers
 *
 * Tests that depend on time install Vitest's fake timers for the whole file, so that what has
 * happened by a given point depends only on the delays the test sets up, never on how busy the
 * machine is. Moving time on lets the real event loop run at every step, so work that isn't on a
 * timer - a broadcast message, or decompressing a value - still finishes along the way.
 */

/**
 * The delay these tests give a target, and wait for in multiples of. It costs nothing in fake time, so
 * it is a second long, to make the 50ms steps that `vi.waitFor` and `settle` take small beside it.
 */
export const DELAY = 1000;

/**
 * Awaits a promise whose work waits on timers - a target's delay, say - moving fake time on until it
 * settles, as awaiting it with real timers would, but at once. One that never settles is left to the
 * test's timeout.
 */
export const settle = async <T>(promise: Promise<T>): Promise<T> => {
    let settled = false;
    promise.then(
        () => (settled = true),
        () => (settled = true)
    );

    // What settles without waiting on a timer takes no time at all. Otherwise time moves in the same
    // steps as `vi.waitFor` checks in, which are small beside the second-long delays these tests use.
    await vi.advanceTimersByTimeAsync(0);
    while (!settled) await vi.advanceTimersByTimeAsync(50);

    return promise;
};

/** Checks that a promise settles once the given time has passed, and not before */
export const expectToSettleAfter = async <T>(promise: Promise<T>, milliseconds: number): Promise<T> => {
    let settled = false;
    promise.then(
        () => (settled = true),
        () => (settled = true)
    );

    if (milliseconds > 0) {
        await vi.advanceTimersByTimeAsync(milliseconds - 1);
        expect(settled).toBe(false);
    }
    await vi.advanceTimersByTimeAsync(Math.min(milliseconds, 1));
    expect(settled).toBe(true);

    return promise;
};

type TestSyncConfig<V> = Partial<{
    value: V;
    delay: number;
    fails: boolean;
    preserveValueOnSave: boolean;
    compressed: boolean;
    timestamp: number | Date;
}>;

export const getTestSync = async <V extends Value>(config: TestSyncConfig<V> = {}) =>
    (await getTestSyncAndValue(config)).sync;

const getTestSyncAndValue = async <V extends Value>({
    value: raw,
    compressed = false,
    timestamp,
    ...config
}: TestSyncConfig<V> = {}) => {
    const value = raw && {
        timestamp: timestamp === undefined ? new Date() : new Date(timestamp),
        buffer: await getBufferFromValue(raw, compressed),
    };
    const target = new MemoryTarget({ value, preserveValueOnSave: true, ...config });
    const sync: Sync<MemoryTarget> = { target, compressed };

    return { sync, value };
};

export const getTestDropBoxSync = async ({ compressed = false }: { compressed?: boolean } = {}): Promise<
    Sync<DropboxTarget>
> => ({
    target: DropboxTarget.deserialise({
        connection: { clientId: "", refreshToken: "", accessToken: "", expiry: new Date().toISOString() },
        user: { id: "", email: "", name: "" },
        path: "/data.bak",
    }),
    compressed,
});
