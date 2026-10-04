/**
 * When a revision of a file was saved, to the millisecond.
 *
 * Dropbox's `server_modified` is only precise to the second, and a manager tells that something else has
 * written to a target by its timestamp changing. Two writes within a second - from two devices, say -
 * would look like one, and the second would never be read.
 *
 * Every `rev` seen so far begins with the time of its write, in microseconds since the epoch, as 13 hex
 * digits, followed by a suffix that is the same for every file in an account. Dropbox doesn't document
 * this, so the time is only used when it falls within the `server_modified` second. Otherwise the
 * milliseconds come from a hash of the `rev`, so that revisions within one second almost always differ.
 * Either way, every device works out the same time for the same revision.
 */
export const getRevisionTime = (serverModified: Date, rev: string | undefined): Date => {
    if (rev === undefined) return serverModified;

    const second = serverModified.valueOf() - (serverModified.valueOf() % 1000);

    const written = /^[0-9a-f]{14,}$/.test(rev) ? Math.floor(parseInt(rev.slice(0, 13), 16) / 1000) : NaN;
    if (written >= second && written < second + 1000) return new Date(written);

    return new Date(second + (hash(rev) % 1000));
};

/** FNV-1a: small, and the same everywhere, which is all this needs */
const hash = (text: string) => {
    let value = 0x811c9dc5;
    for (let index = 0; index < text.length; index++) value = Math.imul(value ^ text.charCodeAt(index), 0x01000193);
    return value >>> 0;
};
