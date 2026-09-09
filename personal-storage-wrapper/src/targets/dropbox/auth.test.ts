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

    expect(connection?.refreshToken).toBe("test-refresh-token");
    expect(opened.close).toHaveBeenCalled();
});

test("Uses an explicit redirect URI when it is given one", async () => {
    const redirectURI = window.location.origin + "/elsewhere.html";
    stubPopupLandingOn(redirectURI);

    const connection = await runAuthInPopup(CLIENT_ID, redirectURI);

    expect(connection?.refreshToken).toBe("test-refresh-token");
});

test("Returns nothing when the popup lands somewhere else on the same origin", async () => {
    stubPopupLandingOn(window.location.origin + "/somewhere-unexpected");

    expect(await runAuthInPopup(CLIENT_ID, window.location.origin + "/expected")).toBeNull();
});

/** A popup that has already come back to the given URL with an authorisation code on it */
const stubPopupLandingOn = (url: string) => {
    const context = {
        closed: false,
        close: vi.fn(),
        location: { origin: window.location.origin, href: url + "?code=" + CODE, search: "?code=" + CODE },
    };

    window.open = vi.fn(() => context) as unknown as typeof window.open;
    window.fetch = vi.fn(async () => ({
        json: async () => ({
            access_token: "test-access-token",
            refresh_token: "test-refresh-token",
            expires_in: 14400,
        }),
    })) as unknown as typeof window.fetch;

    return context;
};
