/**
 * @vitest-environment jsdom
 */
import { expect, test } from "vitest";
import { IndexedDBTarget } from ".";
import { encodeTextToBuffer } from "../../utilities/buffers";

test("Check IndexedDB correctly unavailable", async () => {
    const target = await IndexedDBTarget.create();
    const write = await target.write(await encodeTextToBuffer("TEST_VALUE"));
    expect(write).toEqual({ type: "error" });
});
