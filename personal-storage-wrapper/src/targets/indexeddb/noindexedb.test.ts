/**
 * @vitest-environment jsdom
 */
import { expect, test } from "vitest";
import { IndexedDBTarget } from ".";
import { encodeToArrayBuffer } from "../../utilities/buffers/encoding";

test("Check IndexedDB correctly unavailable", async () => {
    const target = await IndexedDBTarget.create();
    expect(target.online()).toBe(true);

    const write = await target.write(encodeToArrayBuffer("TEST_VALUE"));
    expect(write).toEqual({ type: "error" });
});
