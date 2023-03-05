import { expect, test } from "vitest";
import {
    compressStringWithCompressionStream,
    compressStringWithFFlate,
    decompressStringWithCompressionStream,
    decompressStringWithFFlate,
} from "./compression";

const TEST_BASE_VALUE = "Hello, Test!";

test("All compression and decompression options are reversible", async () => {
    const fflate = await compressStringWithFFlate(TEST_BASE_VALUE);
    const cstream = await compressStringWithCompressionStream(TEST_BASE_VALUE);

    expect(await decompressStringWithFFlate(fflate)).toBe(TEST_BASE_VALUE);
    expect(await decompressStringWithFFlate(cstream)).toBe(TEST_BASE_VALUE);
    expect(await decompressStringWithCompressionStream(fflate)).toBe(TEST_BASE_VALUE);
    expect(await decompressStringWithCompressionStream(cstream)).toBe(TEST_BASE_VALUE);
});
