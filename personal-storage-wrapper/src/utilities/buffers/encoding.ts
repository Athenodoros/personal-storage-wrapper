export const encodeToArrayBuffer = (value: string) => Uint8Array.from(value, (c) => c.charCodeAt(0)).buffer;
export const decodeFromArrayBuffer = (buffer: ArrayBuffer) => String.fromCharCode(...new Uint8Array(buffer));
