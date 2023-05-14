import { DropboxTarget } from "personal-storage-wrapper";
import {
    getGetConnectViaRedirect,
    getHandlePopupBlockerDelay,
    getHandleRedirectRejection,
    runTargetCreation,
} from "../utils/auth";
import { TestConfig } from "../utils/tests";

const CLIENT_ID = "sha2xamq49ewlbo";
const POPUP_URL = window.location.origin + "/dropbox-popup";
const REDIRECT_URL = window.location.origin + "/dropbox-redirect";

export const ConnectInPopup: TestConfig<DropboxTarget> = {
    name: "Connect in Popup",
    runner: runTargetCreation(
        () => DropboxTarget.setupInPopup(CLIENT_ID, POPUP_URL, "/data.bak"),
        "Opening Popup...",
        true
    ),
};

export const getDropboxConnectViaRedirect = getGetConnectViaRedirect(
    "dropbox",
    () => DropboxTarget.redirectForAuth(CLIENT_ID, REDIRECT_URL),
    () => DropboxTarget.catchRedirectForAuth("/data.bak"),
    false
);

export const HandlePopupRejection: TestConfig<DropboxTarget> = {
    name: "Handle Popup Rejection",
    runner: runTargetCreation(
        () => DropboxTarget.setupInPopup(CLIENT_ID, REDIRECT_URL, "/data.bak"),
        "Opening Popup...",
        false
    ),
};

export const HandleRedirectRejection = getHandleRedirectRejection(
    "dropbox",
    () => DropboxTarget.redirectForAuth(CLIENT_ID, REDIRECT_URL),
    () => DropboxTarget.catchRedirectForAuth("/data.back")
);

export const HandleEmptyRedirectCatch: TestConfig<DropboxTarget> = {
    name: "Handle Empty Redirect Catch",
    disabled: () => window.location.href.startsWith(POPUP_URL),
    runner: runTargetCreation(() => DropboxTarget.catchRedirectForAuth("/data.bak"), "Catching redirect...", false),
};

export const HandlePopupBlockerDelay = getHandlePopupBlockerDelay("dropbox", () =>
    DropboxTarget.setupInPopup(CLIENT_ID, POPUP_URL, "/data.bak")
);

export const BadToken: TestConfig<DropboxTarget> = {
    name: "Handle Bad Token",
    runner: async (logger) => {
        logger("Creating bad target...");
        const target = DropboxTarget.deserialise({
            user: null as any,
            connection: {
                clientId: CLIENT_ID,
                refreshToken: "BAD_TOKEN",
                accessToken: "",
                expiry: "1970-01-01",
            },
            path: "/data.bak",
        });

        logger("Attempting operation...");
        const result = await target.timestamp();

        if (result.type === "error") {
            if (result.error !== "INVALID_AUTH") {
                logger("Operation returned incorrect error!");
                return false;
            }
            logger("Operation returned correct error!");
            return true;
        }

        logger("Operation returned result");
        return false;
    },
};

export const OldToken: TestConfig<DropboxTarget> = {
    name: "Refresh Old Token",
    disabled: (target) => target === undefined || (target as any).connection.expiry >= new Date(),
    runner: async (logger, target) => {
        logger("Reading timestamp with old token...");
        const result = await target!.timestamp();

        if (result.type === "error") {
            logger("Operation returned an error!");
            return false;
        }

        if ((target as any).connection.expiry < new Date()) {
            logger("Target did not store renewed token!");
            return false;
        }

        logger("Refresh successful!");
        return true;
    },
};
