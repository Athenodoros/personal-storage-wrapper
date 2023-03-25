import { expect, test } from "vitest";
import { DropboxTarget } from "../../targets/dropbox";
import { MemoryTarget } from "../../targets/memory";
import { resolveStartupConflictsWithRemoteStateAndLatestEdit } from "./defaults";

test("Prioritises recent results", async () => {
    expect(
        await resolveStartupConflictsWithRemoteStateAndLatestEdit([
            { sync: getMemorySync(), value: getValue(0, "A") },
            { sync: getMemorySync(), value: getValue(10, "B") },
        ])
    ).toBe("B");

    expect(
        await resolveStartupConflictsWithRemoteStateAndLatestEdit([
            { sync: getMemorySync(), value: getValue(10, "B") },
            { sync: getMemorySync(), value: getValue(0, "A") },
        ])
    ).toBe("B");
});

test("Prioritises remote results", async () => {
    expect(
        await resolveStartupConflictsWithRemoteStateAndLatestEdit([
            { sync: await getDropBoxSync(), value: getValue(0, "A") },
            { sync: getMemorySync(), value: getValue(10, "B") },
        ])
    ).toBe("A");

    expect(
        await resolveStartupConflictsWithRemoteStateAndLatestEdit([
            { sync: getMemorySync(), value: getValue(10, "B") },
            { sync: await getDropBoxSync(), value: getValue(0, "A") },
        ])
    ).toBe("A");
});

// Utilities
const getValue = (timestamp: number, value: string) => ({ timestamp: new Date(timestamp), value });
const getMemorySync = () => ({ target: new MemoryTarget(), compressed: false });
const getDropBoxSync = async () => ({
    target: await DropboxTarget.deserialise({
        connection: { clientId: "", refreshToken: "", accessToken: "", expiry: new Date() },
        user: { id: "", email: "", name: "" },
        path: "/data.bak",
    }),
    compressed: false,
});
