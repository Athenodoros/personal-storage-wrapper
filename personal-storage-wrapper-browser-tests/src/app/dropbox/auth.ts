import { DropboxTarget } from "personal-storage-wrapper";
import { TestResult } from "../../components/test";
import { getStorageManager } from "../../utils/storage";
import { getConnectInPopup, getGetConnectViaRedirect } from "../utils/auth";
import { TestConfig } from "../utils/tests";

const CLIENT_ID = "sha2xamq49ewlbo";
const POPUP_URL = window.location.origin + "/dropbox-popup";
const REDIRECT_URL = window.location.origin + "/dropbox-redirect";

const ConnectInPopup: TestConfig<DropboxTarget> = getConnectInPopup(() =>
    DropboxTarget.setupInPopup(CLIENT_ID, POPUP_URL, "/data.bak")
);

export const getDropboxConnectViaRedirect = getGetConnectViaRedirect(
    "dropbox",
    () => DropboxTarget.redirectForAuth(CLIENT_ID, REDIRECT_URL),
    () => DropboxTarget.catchRedirectForAuth("/data.bak"),
    false
);

const storage = getStorageManager<"rejection" | "popup">("dropbox-load-behaviour");

const HandlePopupRejection: TestConfig<DropboxTarget> = {
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

const rejectionRedirectResult: Promise<TestResult> =
    storage.load() === "rejection"
        ? DropboxTarget.catchRedirectForAuth("/data.back").then(async (target) => {
              storage.clear();

              if (target === null) return { logs: "No target created!", success: true };
              else return { logs: "Target created!", success: false };
          })
        : Promise.resolve({ logs: "", success: false });
const HandleRedirectRejection: TestConfig<DropboxTarget> = {
    name: "Handle Redirect Rejection",
    state:
        storage.load() === "rejection"
            ? { log: "Redirecting for auth...", result: rejectionRedirectResult }
            : undefined,
    runner: async (logger) => {
        storage.save("rejection");
        DropboxTarget.redirectForAuth(CLIENT_ID, REDIRECT_URL);

        await new Promise<void>((resolve) => setTimeout(() => resolve(), 10000));

        logger("Redirecting for auth...");
        logger("Failed to redirect!");
        return false;
    },
};

const HandleEmptyRedirectCatch: TestConfig<DropboxTarget> = {
    name: "Handle Empty Redirect Catch",
    disabled: () => window.location.href.startsWith(POPUP_URL),
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

const HandlePopupBlockerDelay: TestConfig<DropboxTarget> = {
    name: "Handle Popup Blocker Delay",
    state:
        storage.load() === "popup"
            ? {
                  log: "Refreshing for popup test...",
                  result: DropboxTarget.setupInPopup(CLIENT_ID, POPUP_URL, "/data.bak").then((target) => {
                      storage.clear();

                      if (target === null) return { logs: "No target created!", success: true };
                      else return { logs: "Target created!", success: false };
                  }),
              }
            : undefined,
    runner: async (logger) => {
        storage.save("popup");
        window.location.reload();

        await new Promise<void>((resolve) => setTimeout(() => resolve(), 10000));

        logger("Refreshing for popup test...");
        logger("Failed to redirect!");
        return false;
    },
};

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
