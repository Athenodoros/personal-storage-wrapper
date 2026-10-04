/**
 * @vitest-environment jsdom
 */

import { afterEach, beforeEach, expect, test } from "vitest";
import { DropboxTarget } from "./target";

const originalFetch = globalThis.fetch;
beforeEach(() => {
    Object.defineProperty(window.navigator, "onLine", { value: true, configurable: true });
});
afterEach(() => {
    globalThis.fetch = originalFetch;
});

const getTarget = () =>
    DropboxTarget.deserialise({
        connection: {
            clientId: "",
            refreshToken: "",
            accessToken: "token",
            expiry: new Date(Date.now() + 1e6).toISOString(),
        },
        user: { id: "", email: "", name: "" },
        path: "/data.bak",
    });

/** Answers every request with the metadata of one revision */
const stubRevision = (metadata: { server_modified: string; rev: string }) => {
    globalThis.fetch = (async () => ({ status: 200, json: async () => metadata })) as unknown as typeof fetch;
};

test("Gives a write and a later look at the same revision the same time, to the millisecond", async () => {
    const target = getTarget();
    stubRevision({ server_modified: "2026-10-04T01:33:52Z", rev: "65cf9c2107cd280c59881" });

    const written = await target.write(new ArrayBuffer(0));
    const seen = await target.timestamp();

    expect(written.value?.toISOString()).toBe("2026-10-04T01:33:52.736Z");
    expect(seen.value).toEqual(written.value);
});

test("Tells apart two writes within the same second", async () => {
    const target = getTarget();

    stubRevision({ server_modified: "2026-10-04T01:33:52Z", rev: "65cf9c205bc6b80c59881" });
    const first = await target.timestamp();
    stubRevision({ server_modified: "2026-10-04T01:33:52Z", rev: "65cf9c2107cd280c59881" });
    const second = await target.timestamp();

    expect(first.value).not.toEqual(second.value);
});
