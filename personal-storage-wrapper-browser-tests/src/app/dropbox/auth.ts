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

const ConnectInPopup: TestConfig<DropboxTarget> = {
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

const HandlePopupRejection: TestConfig<DropboxTarget> = {
    name: "Handle Popup Rejection",
    runner: runTargetCreation(
        () => DropboxTarget.setupInPopup(CLIENT_ID, REDIRECT_URL, "/data.bak"),
        "Opening Popup...",
        false
    ),
};

const HandleRedirectRejection = getHandleRedirectRejection(
    "dropbox",
    () => DropboxTarget.redirectForAuth(CLIENT_ID, REDIRECT_URL),
    () => DropboxTarget.catchRedirectForAuth("/data.back")
);

const HandleEmptyRedirectCatch: TestConfig<DropboxTarget> = {
    name: "Handle Empty Redirect Catch",
    disabled: () => window.location.href.startsWith(POPUP_URL),
    runner: runTargetCreation(() => DropboxTarget.catchRedirectForAuth("/data.bak"), "Catching redirect...", false),
};

const HandlePopupBlockerDelay = getHandlePopupBlockerDelay("dropbox", () =>
    DropboxTarget.setupInPopup(CLIENT_ID, POPUP_URL, "/data.bak")
);

const BadToken: TestConfig<DropboxTarget> = {
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
            logger("Operation returned an error!");
            return true;
        }

        logger("Operation returned result");
        return false;
    },
};

export const DropboxAuthTests: TestConfig<DropboxTarget>[] = [
    ConnectInPopup,
    HandlePopupRejection,
    HandleEmptyRedirectCatch,
    HandlePopupBlockerDelay,
    BadToken,
    HandleRedirectRejection,
];
