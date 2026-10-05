/**
 * The Dropbox target against Dropbox itself, for what only Dropbox can say: which writes it refuses.
 *
 * Skipped unless DROPBOX_TEST_REFRESH_TOKEN holds a refresh token, for an account kept for testing,
 * issued to the app DROPBOX_TEST_CLIENT_ID names (TopHat's, by default). It writes to, and then
 * deletes, a file of its own. Run it from this directory with:
 *
 *     DROPBOX_TEST_REFRESH_TOKEN=$(grep '^DROPBOX_TEST_REFRESH_TOKEN=' ../.env.local | cut -d= -f2-) yarn vitest run src/targets/dropbox/target.live.test.ts
 *
 * @vitest-environment jsdom
 */

import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { encodeToArrayBuffer } from "../../utilities/buffers/encoding";
import { DropboxTarget } from "./target";

const TOKEN = process.env.DROPBOX_TEST_REFRESH_TOKEN;
const CLIENT_ID = process.env.DROPBOX_TEST_CLIENT_ID ?? "7ru69iyjvo0wz6t";
const PATH = `/personal-storage-wrapper-live-test-${Date.now()}.bin`;

/** A target as a device that has just started would have it: no access token, and nothing seen yet */
const getDevice = () =>
    DropboxTarget.deserialise({
        connection: { clientId: CLIENT_ID, refreshToken: TOKEN!, accessToken: "", expiry: new Date(0).toISOString() },
        user: { id: "", email: "", name: "" },
        path: PATH,
    });

const contents = async (target: DropboxTarget) => {
    const read = await target.read();
    return read.value ? String.fromCharCode(...new Uint8Array(read.value.buffer)) : null;
};

describe.skipIf(!TOKEN)("Dropbox", () => {
    beforeAll(() => {
        Object.defineProperty(window.navigator, "onLine", { value: true, configurable: true });
    });
    afterAll(async () => {
        await getDevice().delete();
    });

    test("adds the file where none is expected, and refuses to add it over one that is there", async () => {
        const device = getDevice();
        expect(await device.timestamp()).toEqual({ type: "value", value: null });

        expect((await device.write(encodeToArrayBuffer("FIRST"), null)).type).toBe("value");
        expect(await device.write(encodeToArrayBuffer("SECOND"), null)).toEqual({
            type: "error",
            error: "CONFLICT",
            detail: "path/conflict/file/",
        });
        expect(await contents(device)).toBe("FIRST");
    }, 30_000);

    test("replaces the revision a device expects, and refuses once another device has replaced it", async () => {
        const first = getDevice();
        const second = getDevice();
        const seenByFirst = await first.timestamp();
        const seenBySecond = await second.timestamp();

        // The second device saves first
        const saved = await second.write(encodeToArrayBuffer("FROM SECOND"), seenBySecond.value);
        expect(saved.type).toBe("value");

        // So the first device's save, expecting what it saw before that, is refused
        expect(await first.write(encodeToArrayBuffer("FROM FIRST"), seenByFirst.value)).toEqual({
            type: "error",
            error: "CONFLICT",
            detail: "path/conflict/file/",
        });
        expect(await contents(first)).toBe("FROM SECOND");

        // Having looked again, it can save over what it has now seen
        const seenAgain = await first.timestamp();
        expect(seenAgain.value).toEqual(saved.value);
        expect((await first.write(encodeToArrayBuffer("FROM FIRST"), seenAgain.value)).type).toBe("value");
        expect(await contents(second)).toBe("FROM FIRST");
    }, 30_000);

    /**
     * Dropbox only refuses an update that would lose something. Neither of these does, so neither is a
     * conflict: the value already there is the one being saved, or there is no longer any file to lose.
     */
    test("goes ahead with an out-of-date revision when nothing would be lost", async () => {
        const stale = getDevice();
        const current = getDevice();

        // What is there already is what is being saved
        const seenByStale = await stale.timestamp();
        expect((await current.write(encodeToArrayBuffer("SAME"), (await current.timestamp()).value)).type).toBe(
            "value"
        );
        expect((await stale.write(encodeToArrayBuffer("SAME"), seenByStale.value)).type).toBe("value");

        // The file has been deleted since: the update puts it back
        const seenBeforeDeletion = await stale.timestamp();
        await current.delete();
        expect((await stale.write(encodeToArrayBuffer("RECREATED"), seenBeforeDeletion.value)).type).toBe("value");
        expect(await contents(current)).toBe("RECREATED");
    }, 30_000);
});
