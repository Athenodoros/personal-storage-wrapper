import { compress, decompress } from "./compression";
import { decodeFromArrayBuffer, encodeToArrayBuffer } from "./encoding";

export const encodeTextToBuffer = async (value: string, compressed: boolean) =>
    compressed ? compress(value) : encodeToArrayBuffer(value);

export const decodeTextFromBuffer = async (buffer: ArrayBuffer, compressed: boolean) =>
    compressed ? decompress(buffer) : decodeFromArrayBuffer(buffer);
