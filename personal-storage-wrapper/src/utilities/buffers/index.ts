import { compress, decompress } from "./compression";
import { decodeFromArrayBuffer, encodeToArrayBuffer } from "./encoding";

export const encodeTextToBuffer = async (value: string, compressed: boolean = false) =>
    compressed ? compress(value) : encodeToArrayBuffer(value);

export const decodeTextFromBuffer = async (buffer: ArrayBuffer, compressed: boolean = false) =>
    compressed ? decompress(buffer) : decodeFromArrayBuffer(buffer);
