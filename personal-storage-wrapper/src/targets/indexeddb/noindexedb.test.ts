/**
 * @vitest-environment jsdom
 */
import { expect, test } from "vitest";
import { IndexedDBTarget } from ".";

test("Check IndexedDB correctly unavailable", async () => {
    const maybeTarget = await IndexedDBTarget.create();
    expect(maybeTarget).toBeNull();
});
