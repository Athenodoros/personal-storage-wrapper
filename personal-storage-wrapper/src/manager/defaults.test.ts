import { expect, test } from "vitest";
import { DropboxTarget } from "../targets/dropbox";
import { MemoryTarget } from "../targets/memory";
import { resolveStartupConflictsWithRemoteStateAndLatestEdit } from "./defaults";

test("Prioritises valid results", async () => {
    expect(
        await resolveStartupConflictsWithRemoteStateAndLatestEdit([
            { sync: getMemorySync(), value: getValue(0, "A") },
            { sync: getMemorySync(), value: { type: "value" as const, value: null } },
        ])
    ).toBe("A");

    expect(
        await resolveStartupConflictsWithRemoteStateAndLatestEdit([
            { sync: getMemorySync(), value: getValue(0, "A") },
            { sync: getMemorySync(), value: { type: "value" as const, value: null } },
        ])
    ).toBe("A");
});

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
const getValue = (timestamp: number, value: string) => ({
    type: "value" as const,
    value: { timestamp: new Date(timestamp), value },
});
const common = { compressed: false, state: "SYNCED" as const };
const getMemorySync = () => ({ target: new MemoryTarget(), ...common });
const getDropBoxSync = async () => ({
    target: await DropboxTarget.deserialise({
        connection: { clientId: "", refreshToken: "", accessToken: "", expiry: new Date() },
        user: { id: "", email: "", name: "" },
        path: "/data.bak",
    }),
    ...common,
});
