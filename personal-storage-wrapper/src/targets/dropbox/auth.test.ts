/**
 * @vitest-environment jsdom
 */

import { afterEach, expect, test, vi } from "vitest";
import { runAuthInPopup } from "./auth";

const CLIENT_ID = "test-client-id";
const CODE = "test-auth-code";

const { open, fetch } = window;
afterEach(() => {
    Object.assign(window, { open, fetch });
});

/**
 * The popup URL used to be checked against the argument rather than the default worked out from it,
 * so a caller that left the redirect URI to be filled in never got a connection back at all.
 */
test("Falls back to the current page as the redirect URI", async () => {
    const opened = stubPopupLandingOn(window.location.href);

    const connection = await runAuthInPopup(CLIENT_ID);

    expect(connection.value?.refreshToken).toBe("test-refresh-token");
    expect(opened.close).toHaveBeenCalled();
});

test("Uses an explicit redirect URI when it is given one", async () => {
    const redirectURI = window.location.origin + "/elsewhere.html";
    stubPopupLandingOn(redirectURI);

    const connection = await runAuthInPopup(CLIENT_ID, redirectURI);

    expect(connection.value?.refreshToken).toBe("test-refresh-token");
});

test("Returns nothing when the popup lands somewhere else on the same origin", async () => {
    stubPopupLandingOn(window.location.origin + "/somewhere-unexpected");

    expect(await runAuthInPopup(CLIENT_ID, window.location.origin + "/expected")).toEqual({
        type: "value",
        value: null,
    });
});

test("Returns nothing when the popup is blocked or closed, since the user didn't sign in", async () => {
    window.open = vi.fn(() => null) as unknown as typeof window.open;
    expect(await runAuthInPopup(CLIENT_ID)).toEqual({ type: "value", value: null });

    const opened = stubPopupLandingOn(window.location.href);
    opened.closed = true;
    expect(await runAuthInPopup(CLIENT_ID)).toEqual({ type: "value", value: null });
});

/**
 * Dropbox answers a code it won't exchange with an error and no tokens. That used to come back as a
 * connection whose tokens were `undefined`, and the target built on it failed later and silently.
 */
test("Reports a code that Dropbox won't exchange, with what Dropbox said", async () => {
    stubPopupLandingOn(window.location.href, {
        status: 400,
        body: { error: "invalid_grant", error_description: "code doesn't exist or has expired" },
    });

    expect(await runAuthInPopup(CLIENT_ID)).toEqual({
        type: "error",
        error: "INVALID_AUTH",
        detail: "code doesn't exist or has expired",
    });
});

test("Reports an exchange that fails on the way, rather than never returning", async () => {
    stubPopupLandingOn(window.location.href);
    window.fetch = vi.fn(async () => {
        throw new TypeError("Failed to fetch");
    }) as unknown as typeof window.fetch;

    const result = await Promise.race([
        runAuthInPopup(CLIENT_ID),
        new Promise((resolve) => setTimeout(() => resolve("NEVER RETURNED"), 1000)),
    ]);
    expect(result).toEqual({ type: "error", error: "UNKNOWN", detail: "Failed to fetch" });
});

const TOKENS = { access_token: "test-access-token", refresh_token: "test-refresh-token", expires_in: 14400 };

/** A popup that has already come back to the given URL with an authorisation code on it */
const stubPopupLandingOn = (
    url: string,
    exchange: { status: number; body: unknown } = { status: 200, body: TOKENS }
) => {
    const context = {
        closed: false,
        close: vi.fn(),
        location: { origin: window.location.origin, href: url + "?code=" + CODE, search: "?code=" + CODE },
    };

    window.open = vi.fn(() => context) as unknown as typeof window.open;
    window.fetch = vi.fn(async () => ({
        status: exchange.status,
        json: async () => exchange.body,
    })) as unknown as typeof window.fetch;

    return context;
};
