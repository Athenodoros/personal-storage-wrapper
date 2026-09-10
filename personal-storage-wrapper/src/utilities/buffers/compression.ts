/// <reference path="./CompressionStream.d.ts" />

export const compress = (value: string): Promise<ArrayBuffer> =>
    ("CompressionStream" in window ? compressStringWithCompressionStream : compressStringWithFFlate)(value);

export const decompress = async (value: ArrayBuffer): Promise<string> =>
    ("CompressionStream" in window ? decompressStringWithCompressionStream : decompressStringWithFFlate)(value);

export const compressStringWithCompressionStream = (value: string): Promise<ArrayBuffer> => {
    const buffer = Uint8Array.from(value, (c) => c.charCodeAt(0));
    return runArrayBufferThroughStream(buffer, new CompressionStream("gzip"));
};

export const compressStringWithFFlate = async (value: string): Promise<ArrayBuffer> => {
    const { gzip, strToU8 } = await import("fflate");
    return new Promise((resolve, reject) =>
        gzip(strToU8(value), (error, data) => (error ? reject(error) : resolve(data.buffer)))
    );
};

export const decompressStringWithCompressionStream = async (value: ArrayBuffer): Promise<string> => {
    const array = await runArrayBufferThroughStream(value, new DecompressionStream("gzip"));
    return new TextDecoder().decode(array);
};

export const decompressStringWithFFlate = async (value: ArrayBuffer): Promise<string> => {
    const { gunzip, strFromU8 } = await import("fflate");
    return new Promise((resolve, reject) =>
        gunzip(new Uint8Array(value), (error, data) => (error ? reject(error) : resolve(strFromU8(data))))
    );
};

// Largely copied from https://wicg.github.io/compression/#example-deflate-compress
const runArrayBufferThroughStream = async (buffer: ArrayBuffer, processor: any) => {
    // Write values to stream
    const writer = (processor.writable as WritableStream).getWriter();

    /**
     * A buffer that is not what the stream expected - a file in an older format, or a download that
     * returned something else entirely - fails both of these as well as the read below. The read is
     * where the caller finds out, so these are swallowed rather than left to reject on their own,
     * with nobody waiting on them, as an unhandled rejection in the middle of the page.
     */
    const ignoreFailure = () => undefined;
    writer.write(new Uint8Array(buffer)).catch(ignoreFailure);
    writer.close().catch(ignoreFailure);

    // Read all stream values
    const output = [];
    const reader = (processor.readable as ReadableStream).getReader();
    let totalSize = 0;
    while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        output.push(value);
        totalSize += value.byteLength;
    }

    // Concatenate values and return
    const concatenated = new Uint8Array(totalSize);
    let offset = 0;
    for (const array of output) {
        concatenated.set(array, offset);
        offset += array.byteLength;
    }
    return concatenated;
};
