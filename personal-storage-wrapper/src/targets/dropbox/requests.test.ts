/**
 * @vitest-environment jsdom
 */

import { afterEach, beforeEach, expect, test } from "vitest";
import { runDropboxQuery } from "./requests";
import { DropboxConnection } from "./types";

const getConnection = (): DropboxConnection => ({
    clientId: "client",
    refreshToken: "refresh",
    accessToken: "stale",
    // In the past, so the first thing every query does is refresh the token
    expiry: new Date(0),
});

const REFRESH_RESPONSE = { access_token: "fresh", expires_in: 14400 };

const originalFetch = globalThis.fetch;
// jsdom's navigator has no onLine of its own, and every query checks it before going out
beforeEach(() => {
    Object.defineProperty(window.navigator, "onLine", { value: true, configurable: true });
});
afterEach(() => {
    globalThis.fetch = originalFetch;
});

/** Answers token refreshes, and the request itself with whatever status is asked for */
const stubFetch = (statuses: number[]) => {
    const calls: string[] = [];
    let index = 0;

    globalThis.fetch = (async (input: RequestInfo | URL) => {
        const url = String(input);
        calls.push(url);

        if (url.includes("oauth2/token")) return { status: 200, json: async () => REFRESH_RESPONSE } as Response;

        const status = statuses[Math.min(index++, statuses.length - 1)];
        return { status, json: async () => ({}) } as Response;
    }) as typeof fetch;

    return calls;
};

test("Refreshes the token once and retries when a request is unauthorised", async () => {
    const calls = stubFetch([401, 200]);

    const result = await runDropboxQuery(getConnection(), "https://api.dropboxapi.com/2/files/get_metadata");

    expect(result.type).toBe("value");
    expect(result.value?.status).toBe(200);
    expect(calls.filter((url) => url.includes("oauth2/token"))).toHaveLength(2);
});

/**
 * An app whose grant is missing a scope answers 401 however fresh the token is. Retrying on every
 * 401 refreshed and re-requested forever, and the caller never heard back at all.
 */
test("Gives up on a second unauthorised response rather than retrying forever", async () => {
    const calls = stubFetch([401]);

    const result = await Promise.race([
        runDropboxQuery(getConnection(), "https://api.dropboxapi.com/2/files/download"),
        new Promise((resolve) => setTimeout(() => resolve("NEVER RETURNED"), 100)),
    ]);

    expect(result).toEqual({ type: "error", error: "INVALID_AUTH" });
    expect(calls.length).toBeLessThan(6);
});
