/**
 * @vitest-environment jsdom
 */

import { expect, test, vi } from "vitest";
import { PersonalStorageManager } from "../manager";
import {
    DefaultTarget,
    getSyncDataFromLocalStorage,
    resolveStartupConflictsWithRemoteStateAndLatestEdit,
    saveSyncDataToLocalStorage,
} from "./defaults";
import { getTestDropBoxSync, getTestSync } from "./test";

test("Prioritises recent results", async () => {
    expect(
        await resolveStartupConflictsWithRemoteStateAndLatestEdit<DefaultTarget, string>("D", "D", [
            await getSyncAndValue(0, "A"),
            await getSyncAndValue(10, "B"),
        ])
    ).toBe("B");

    expect(
        await resolveStartupConflictsWithRemoteStateAndLatestEdit<DefaultTarget, string>("D", "D", [
            await getSyncAndValue(10, "B"),
            await getSyncAndValue(0, "A"),
        ])
    ).toBe("B");
});

test("Prioritises remote results", async () => {
    expect(
        await resolveStartupConflictsWithRemoteStateAndLatestEdit<DefaultTarget, string>("D", "D", [
            await getSyncAndValue(0, "A", true),
            await getSyncAndValue(10, "B"),
        ])
    ).toBe("A");

    expect(
        await resolveStartupConflictsWithRemoteStateAndLatestEdit<DefaultTarget, string>("D", "D", [
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

/**
 * Sync data
 */

test("Keeps each manager's syncs apart, and a manager without an id where they always were", () => {
    saveSyncDataToLocalStorage("DEFAULT");
    saveSyncDataToLocalStorage("TOPHAT", "tophat");

    expect(localStorage.getItem("personal-storage-manager-state")).toBe("DEFAULT");
    expect(getSyncDataFromLocalStorage("tophat")).toBe("TOPHAT");
    expect(getSyncDataFromLocalStorage("psm-default-id")).toBe("DEFAULT");

    PersonalStorageManager.clearSyncData("tophat");
    expect(getSyncDataFromLocalStorage("tophat")).toBeNull();
    expect(getSyncDataFromLocalStorage()).toBe("DEFAULT");
    localStorage.clear();
});

test("Carries on without saved syncs where the browser refuses localStorage", () => {
    const refuse = () => {
        throw new DOMException("The operation is insecure.", "SecurityError");
    };
    const spies = [
        vi.spyOn(Storage.prototype, "getItem").mockImplementation(refuse),
        vi.spyOn(Storage.prototype, "setItem").mockImplementation(refuse),
        vi.spyOn(Storage.prototype, "removeItem").mockImplementation(refuse),
    ];

    expect(getSyncDataFromLocalStorage("tophat")).toBeNull();
    expect(() => saveSyncDataToLocalStorage("TOPHAT", "tophat")).not.toThrow();
    expect(() => PersonalStorageManager.clearSyncData("tophat")).not.toThrow();

    spies.forEach((spy) => spy.mockRestore());
});
