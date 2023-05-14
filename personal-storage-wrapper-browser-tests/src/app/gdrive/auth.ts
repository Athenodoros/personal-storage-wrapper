import { GDriveTarget } from "personal-storage-wrapper";
import {
    getGetConnectViaRedirect,
    getHandlePopupBlockerDelay,
    getHandleRedirectRejection,
    runTargetCreation,
} from "../utils/auth";
import { TestConfig } from "../utils/tests";

const CLIENT_ID = "151346048888-a4i2hah9aqh8bm4058muuau52sfcp0ge.apps.googleusercontent.com";
const POPUP_URL = window.location.origin + "/gdrive-popup";
const REDIRECT_URL = window.location.origin + "/gdrive-redirect";

const ConnectInPopup: TestConfig<GDriveTarget> = {
    name: "Connect in Popup",
    runner: runTargetCreation(
        () => GDriveTarget.setupInPopup(CLIENT_ID, POPUP_URL, { name: "/data.bak" }),
        "Opening Popup...",
        true
    ),
};

export const getGDriveConnectViaRedirect = getGetConnectViaRedirect(
    "gdrive",
    () => GDriveTarget.redirectForAuth(CLIENT_ID, REDIRECT_URL),
    () => GDriveTarget.catchRedirectForAuth({ name: "/data.bak" }, []).then((result) => result && result.target),
    true
);

const HandlePopupRejection: TestConfig<GDriveTarget> = {
    name: "Handle Popup Rejection",
    runner: runTargetCreation(
        () => GDriveTarget.setupInPopup(CLIENT_ID, POPUP_URL, { name: "/data.bak" }),
        "Opening Popup...",
        false
    ),
};

const HandleRedirectRejection = getHandleRedirectRejection(
    "gdrive",
    () => GDriveTarget.redirectForAuth(CLIENT_ID, REDIRECT_URL),
    () => GDriveTarget.catchRedirectForAuth({ name: "/data.bak" }, []).then((result) => result && result.target)
);

const HandleEmptyRedirectCatch: TestConfig<GDriveTarget> = {
    name: "Handle Empty Redirect Catch",
    disabled: () => window.location.href.startsWith(POPUP_URL),
    runner: runTargetCreation(
        () => GDriveTarget.catchRedirectForAuth({ name: "/data.bak" }, []).then((result) => result && result.target),
        "Catching redirect...",
        false
    ),
};

const HandlePopupBlockerDelay = getHandlePopupBlockerDelay("gdrive", () =>
    GDriveTarget.setupInPopup(CLIENT_ID, POPUP_URL, { name: "/data.bak" })
);

const BadToken: TestConfig<GDriveTarget> = {
    name: "Handle Bad Token",
    runner: async (logger) => {
        logger("Creating bad target...");
        const target = GDriveTarget.deserialise({
            user: null as any,
            connection: {
                clientId: CLIENT_ID,
                useAppData: true,
                scopes: [],
                accessToken: "BAD_TOKEN",
                expiry: "9999-12-31",
            },
            file: { id: "" },
        });

        logger("Attempting operation...");
        const result = await target.timestamp();

        if (result.type === "error") {
            logger("Operation returned an error!");
            return true;
        }

        logger("Operation returned result");
        return false;
    },
};

const FindExistingFile: TestConfig<GDriveTarget> = {
    name: "Finds Existing File",
    disabled: (target) => target === undefined,
    runner: async (logger, target) => {
        logger("Finding existing file details...");
        const details = await target!.getFileDetails();

        if (details.type === "error") {
            logger("Failed to get file details!");
            return false;
        }

        logger("Creating new target from name...");
        const created1 = await GDriveTarget.setupInPopup(CLIENT_ID, POPUP_URL, { name: details.value.name });
        if (created1 === null) {
            logger("Failed to create new target!");
            return false;
        }
        logger("Checking file equality...");
        if (created1.file.id !== target!.file.id) {
            logger("Found wrong file!");
            return false;
        }

        logger("Creating new target from name and MIME...");
        const created2 = await GDriveTarget.setupInPopup(CLIENT_ID, POPUP_URL, {
            name: details.value.name,
            mime: details.value.mimeType,
        });
        if (created2 === null) {
            logger("Failed to create new target!");
            return false;
        }
        logger("Checking file equality...");
        if (created2.file.id !== target!.file.id) {
            logger("Found wrong file!");
            return false;
        }

        logger("Creating new target from name and different MIME...");
        const created3 = await GDriveTarget.setupInPopup(CLIENT_ID, POPUP_URL, {
            name: details.value.name,
            mime: "" + Math.random(),
        });
        if (created3 === null) {
            logger("Failed to create new target!");
            return false;
        }
        logger("Checking file equality...");
        if (created3.file.id === target!.file.id) {
            logger("Found correct file!");
            return false;
        }

        logger("Correctly created new targets!");
        return true;
    },
};

const RefreshInPopup: TestConfig<GDriveTarget> = {
    name: "Refresh in Popup",
    disabled: (target) => target === undefined,
    runner: async (logger, target) => {
        logger("Opening popup for auth refreshing...");
        const { accessToken, expiry } = (target as any).connection;
        const result = await target!.refreshAuthInPopup(POPUP_URL);

        logger("Confirming update...");
        if (result === false) {
            if ((target as any).connection.accessToken !== accessToken) {
                logger("Failed to update but updated accessToken!");
                return false;
            }
            if ((target as any).connection.expiry !== expiry) {
                logger("Failed to update but updated expiry!");
                return false;
            }

            logger("Failed to update!");
            return false;
        }

        if ((target as any).connection.accessToken === accessToken) {
            logger("Updated but failed to update accessToken!");
            return false;
        }
        if ((target as any).connection.expiry === expiry) {
            logger("Updated but failed to update expiry!");
            return false;
        }
        if ((target as any).connection.expiry < new Date()) {
            logger("Updated but already has expired token!");
            return false;
        }

        logger("Updated connection!");
        return true;
    },
};

export const GDriveAuthTests: TestConfig<GDriveTarget>[] = [
    ConnectInPopup,
    HandlePopupRejection,
    HandleRedirectRejection,
    HandleEmptyRedirectCatch,
    HandlePopupBlockerDelay,
    BadToken,
    FindExistingFile,
    RefreshInPopup,
];
