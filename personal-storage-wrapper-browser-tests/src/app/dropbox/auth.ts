import { DropboxTarget } from "personal-storage-wrapper";
import { DropboxTest } from "./types";

const CLIENT_ID = "sha2xamq49ewlbo";
const REDIRECT_URL = window.location.origin + "/dropbox-popup";

export const ConnectInPopup: DropboxTest = {
    name: "Connect in Popup",
    runner: async (logger, _, addTarget) => {
        logger("Opening Popup...");
        const target = await DropboxTarget.setupInPopup(CLIENT_ID, REDIRECT_URL, "/data.json.tgz");

        if (target === null) {
            logger("No target created!");
            return false;
        }

        logger("Target created and added!");
        addTarget(target);
        return true;
    },
};

export const ConnectViaRedirect: DropboxTest = {
    name: "Connect via Redirect",
};

export const HandlePopupRejection: DropboxTest = {
    name: "Handle Popup Rejection",
    runner: async (logger) => {
        logger("Opening Popup...");
        const target = await DropboxTarget.setupInPopup(CLIENT_ID, REDIRECT_URL, "/data.json.tgz");

        if (target === null) {
            logger("No target created!");
            return true;
        }

        logger("Got a target back!");
        console.log(target);
        return false;
    },
};

export const HandleRedirectRejection: DropboxTest = {
    name: "Handle Redirect Rejection",
};

export const HandleEmptyRedirectCatch: DropboxTest = {
    name: "Handle Empty Redirect Catch",
    disabled: () => window.location.href.startsWith(REDIRECT_URL),
    runner: async (logger) => {
        logger("Catching redirect...");

        const target = await DropboxTarget.catchRedirectForAuth("/data.json.tgz");

        if (target === null) {
            logger("No target created!");
            return true;
        }

        logger("Got a target back?!");
        console.log(target);
        return false;
    },
};

export const HandlePopupBlockerDelay: DropboxTest = {
    name: "Handle Popup Blocker Delay",
};
