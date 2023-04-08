import { expect, test } from "vitest";
import { resolveStartupConflictsWithRemoteStateAndLatestEdit } from "./defaults";
import { getTestDropBoxSync, getTestSync } from "./test";

test("Prioritises recent results", async () => {
    expect(
        await resolveStartupConflictsWithRemoteStateAndLatestEdit("D", "D", [
            await getSyncAndValue(0, "A"),
            await getSyncAndValue(10, "B"),
        ])
    ).toBe("B");

    expect(
        await resolveStartupConflictsWithRemoteStateAndLatestEdit("D", "D", [
            await getSyncAndValue(10, "B"),
            await getSyncAndValue(0, "A"),
        ])
    ).toBe("B");
});

test("Prioritises remote results", async () => {
    expect(
        await resolveStartupConflictsWithRemoteStateAndLatestEdit("D", "D", [
            await getSyncAndValue(0, "A", true),
            await getSyncAndValue(10, "B"),
        ])
    ).toBe("A");

    expect(
        await resolveStartupConflictsWithRemoteStateAndLatestEdit("D", "D", [
            await getSyncAndValue(10, "B"),
            await getSyncAndValue(0, "A", true),
        ])
    ).toBe("A");
});

// Utilities
const getSyncAndValue = async (timestamp: number, rawValue: string, remote: boolean = false) => {
    const sync = await (remote ? getTestDropBoxSync : getTestSync)();
    const value = { timestamp: new Date(timestamp), value: rawValue };
    return { sync, value };
};
