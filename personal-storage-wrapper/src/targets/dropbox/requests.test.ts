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

test("Says why when the second unauthorised response explains itself, such as a missing scope", async () => {
    globalThis.fetch = (async (input: RequestInfo | URL) =>
        String(input).includes("oauth2/token")
            ? ({ status: 200, json: async () => REFRESH_RESPONSE } as Response)
            : ({
                  status: 401,
                  json: async () => ({
                      error_summary: "missing_scope/..",
                      error: { ".tag": "missing_scope", required_scope: "files.content.read" },
                  }),
              } as Response)) as typeof fetch;

    const result = await runDropboxQuery(getConnection(), "https://content.dropboxapi.com/2/files/download");

    expect(result).toEqual({ type: "error", error: "INVALID_AUTH", detail: "missing_scope/.." });
});

/** Answers token refreshes with whatever is given, and anything else with an empty success */
const stubRefresh = (refresh: () => Promise<Response>) => {
    const calls: string[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL) => {
        const url = String(input);
        calls.push(url);
        return url.includes("oauth2/token") ? refresh() : ({ status: 200, json: async () => ({}) } as Response);
    }) as typeof fetch;
    return calls;
};

/** Resolves to a marker rather than hanging the test runner, so a regression fails instead of timing out */
const withTimeout = <T>(promise: Promise<T>) =>
    Promise.race([promise, new Promise((resolve) => setTimeout(() => resolve("NEVER RETURNED"), 1000))]);

test("Reports a refresh token that Dropbox has revoked, with what Dropbox said, and makes no request with it", async () => {
    const calls = stubRefresh(
        async () =>
            ({
                status: 400,
                json: async () => ({
                    error: "invalid_grant",
                    error_description: "refresh token is invalid or revoked",
                }),
            } as Response)
    );

    const result = await runDropboxQuery(getConnection(), "https://api.dropboxapi.com/2/files/get_metadata");

    expect(result).toEqual({ type: "error", error: "INVALID_AUTH", detail: "refresh token is invalid or revoked" });
    expect(calls.every((url) => url.includes("oauth2/token"))).toBe(true);
});

/**
 * The refresh used to be awaited inside an async executor with nothing to catch what it threw, so a
 * failed `fetch` left the request, and everything queued behind it, waiting for good.
 */
test("Reports a refresh that fails on the way, rather than never returning", async () => {
    stubRefresh(async () => {
        throw new TypeError("Failed to fetch");
    });

    const result = await withTimeout(
        runDropboxQuery(getConnection(), "https://api.dropboxapi.com/2/files/get_metadata")
    );

    expect(result).toEqual({ type: "error", error: "UNKNOWN", detail: "Failed to fetch" });
});

test("Reports a refresh that comes back without a token, and doesn't send `undefined` as one", async () => {
    const calls = stubRefresh(
        async () =>
            ({
                status: 503,
                json: async () => Promise.reject(new SyntaxError("Unexpected token <")),
            } as unknown as Response)
    );
    const connection = getConnection();

    const result = await withTimeout(runDropboxQuery(connection, "https://api.dropboxapi.com/2/files/get_metadata"));

    expect(result).toEqual({ type: "error", error: "UNKNOWN", detail: "Dropbox did not refresh the token (503)" });
    expect(connection.accessToken).toBe("stale");
    expect(calls.every((url) => url.includes("oauth2/token"))).toBe(true);
});
