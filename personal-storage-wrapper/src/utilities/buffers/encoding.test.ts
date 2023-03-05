import { expect, test } from "vitest";
import { decodeFromArrayBuffer, encodeToArrayBuffer } from "./encoding";

const TEST_BASE_VALUE = "Hello, Test!";

test("Encoding and decoding to ArrayBuffers are reversible", async () => {
    expect(decodeFromArrayBuffer(encodeToArrayBuffer(TEST_BASE_VALUE))).toBe(TEST_BASE_VALUE);
});
