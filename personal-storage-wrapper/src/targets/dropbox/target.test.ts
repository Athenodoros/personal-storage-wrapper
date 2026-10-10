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

/** Answers metadata requests with one revision, and uploads with another, recording each upload's mode */
const stubUploads = (
    seen: { server_modified: string; rev: string } | null,
    uploaded: { status: number; json: unknown }
) => {
    const modes: unknown[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        if (String(input).endsWith("/files/upload")) {
            modes.push(JSON.parse((init!.headers as Record<string, string>)["Dropbox-API-Arg"]).mode);
            return { status: uploaded.status, json: async () => uploaded.json };
        }
        return seen
            ? { status: 200, json: async () => seen }
            : { status: 409, json: async () => ({ error_summary: "path/not_found/.." }) };
    }) as unknown as typeof fetch;
    return modes;
};

const REVISION = { server_modified: "2026-10-04T01:33:52Z", rev: "65cf9c2107cd280c59881" };
const NEXT_REVISION = { server_modified: "2026-10-04T01:34:10Z", rev: "65cf9c3217cd280c59881" };

test("Writes over the revision it expects with an update of that revision, which Dropbox refuses if the file has moved on", async () => {
    const target = getTarget();
    const modes = stubUploads(REVISION, { status: 200, json: NEXT_REVISION });

    const seen = await target.timestamp();
    expect((await target.write(new ArrayBuffer(0), seen.value)).type).toBe("value");
    expect(modes).toEqual([{ ".tag": "update", update: REVISION.rev }]);
});

test("Writes where it expects no file with an add, and otherwise overwrites", async () => {
    const target = getTarget();
    const modes = stubUploads(null, { status: 200, json: NEXT_REVISION });

    expect(await target.timestamp()).toEqual({ type: "value", value: null });
    await target.write(new ArrayBuffer(0), null);
    await target.write(new ArrayBuffer(0));
    expect(modes).toEqual(["add", "overwrite"]);
});

test("Expects the revision its own last write made", async () => {
    const target = getTarget();
    const modes = stubUploads(REVISION, { status: 200, json: NEXT_REVISION });

    const written = await target.write(new ArrayBuffer(0));
    await target.write(new ArrayBuffer(0), written.value);
    expect(modes).toEqual(["overwrite", { ".tag": "update", update: NEXT_REVISION.rev }]);
});

test("Refuses, without asking Dropbox, a write that expects a revision it hasn't seen", async () => {
    const target = getTarget();
    const modes = stubUploads(REVISION, { status: 200, json: NEXT_REVISION });

    await target.timestamp();
    const result = await target.write(new ArrayBuffer(0), new Date(0));
    expect(result).toMatchObject({ type: "error", error: "CONFLICT" });
    expect(modes).toEqual([]);
});

test("Reports Dropbox's refusal of an out-of-date revision as a conflict", async () => {
    const target = getTarget();
    stubUploads(REVISION, { status: 409, json: { error_summary: "path/conflict/file/..", error: { ".tag": "path" } } });

    const seen = await target.timestamp();
    expect(await target.write(new ArrayBuffer(0), seen.value)).toEqual({
        type: "error",
        error: "CONFLICT",
        detail: "path/conflict/file/..",
    });
});

/** Answers a token refresh for one refresh token, and the account request with whoever it belongs to */
const stubAccount = (refreshToken: string) => {
    const authorisations: string[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes("oauth2/token"))
            return url.includes("refresh_token=" + refreshToken)
                ? { status: 200, json: async () => ({ access_token: "fresh", expires_in: 14400 }) }
                : { status: 400, json: async () => ({ error: "invalid_grant" }) };

        authorisations.push((init!.headers as Record<string, string>).authorization);
        if (url.endsWith("users/get_current_account"))
            return {
                status: 200,
                json: async () => ({ account_id: "dbid:1", email: "a@example.com", name: { display_name: "A" } }),
            };
        return { status: 200, json: async () => REVISION };
    }) as unknown as typeof fetch;
    return authorisations;
};

test("Makes a target from a refresh token, for the account it belongs to, if Dropbox still accepts it", async () => {
    stubAccount("kept");

    const target = await DropboxTarget.fromRefreshToken("app", "kept", "/data.json.gz");
    expect(target.value?.user).toEqual({ id: "dbid:1", email: "a@example.com", name: "A" });
    expect(target.value?.path).toBe("/data.json.gz");

    expect(await DropboxTarget.fromRefreshToken("app", "revoked", "/data.json.gz")).toMatchObject({
        type: "error",
        error: "INVALID_AUTH",
    });
});

test("Reads another path of the same account with the same connection", async () => {
    const authorisations = stubAccount("kept");
    const target = (await DropboxTarget.fromRefreshToken("app", "kept", "/data.json.gz")).value!;

    const other = target.withPath("/data.zip");
    await other.timestamp();

    expect(other.path).toBe("/data.zip");
    expect(other.user).toEqual(target.user);
    expect(other.equals(target)).toBe(false);
    expect(authorisations).toEqual(["Bearer fresh", "Bearer fresh"]);
});
