import { expect, test } from "vitest";
import { getRevisionTime } from "./revisions";

// Two writes within one second, as a test account reported them
const FIRST = { server_modified: "2026-10-04T01:33:52Z", rev: "65cf9c205bc6b80c59881" };
const SECOND = { server_modified: "2026-10-04T01:33:52Z", rev: "65cf9c2107cd280c59881" };

const time = ({ server_modified, rev }: { server_modified: string; rev: string }) =>
    getRevisionTime(new Date(server_modified), rev);

test("Reads the time of a write to the millisecond from its revision", () => {
    expect(time(FIRST).toISOString()).toBe("2026-10-04T01:33:52.031Z");
    expect(time(SECOND).toISOString()).toBe("2026-10-04T01:33:52.736Z");
});

test("Falls back to a time within the second for a revision it can't read", () => {
    // The example in Dropbox's documentation, which has no time in it
    const documented = { server_modified: "2015-05-12T15:50:38Z", rev: "a1c10ce0dd78" };
    // A time from the revision that isn't within the second that Dropbox gives
    const elsewhere = { server_modified: "2026-10-04T01:33:53Z", rev: FIRST.rev };

    for (const write of [documented, elsewhere]) {
        const second = new Date(write.server_modified).valueOf();
        expect(time(write).valueOf()).toBeGreaterThanOrEqual(second);
        expect(time(write).valueOf()).toBeLessThan(second + 1000);

        // The same on every device that sees the revision
        expect(time(write)).toEqual(time({ ...write }));
    }
    expect(time(elsewhere)).not.toEqual(time({ ...elsewhere, rev: SECOND.rev }));
});
