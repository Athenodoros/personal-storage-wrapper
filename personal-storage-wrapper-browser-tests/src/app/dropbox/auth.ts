import { DropboxTarget } from "personal-storage-wrapper";
import { TestResult } from "../../components/test";
import { getStorageManager } from "../../utils/storage";
import { TestConfig } from "../tests";

const CLIENT_ID = "sha2xamq49ewlbo";
const POPUP_URL = window.location.origin + "/dropbox-popup";
const REDIRECT_URL = window.location.origin + "/dropbox-redirect";

const ConnectInPopup: TestConfig<DropboxTarget> = {
    name: "Connect in Popup",
    runner: async (logger, _, addTarget) => {
        logger("Opening Popup...");
        const target = await DropboxTarget.setupInPopup(CLIENT_ID, POPUP_URL, "/data.bak");

        if (target === null) {
            logger("No target created!");
            return false;
        }

        logger("Target created and added!");
        addTarget(target);
        return true;
    },
};

const storage = getStorageManager<"approval" | "rejection" | "popup">("dropbox-load-behaviour");

let approvalAddCache: (target: DropboxTarget) => void;
let approvalRedirectResult: Promise<TestResult> | null = null;
export const getConnectViaRedirect = (add: (target: DropboxTarget) => void): TestConfig<DropboxTarget> => {
    approvalAddCache = add;

    if (approvalRedirectResult === null) {
        approvalRedirectResult = DropboxTarget.catchRedirectForAuth("/data.bak").then(
            async (target): Promise<TestResult> => {
                if (target === null) return { success: false, logs: "No target created!" };

                const target2 = await DropboxTarget.catchRedirectForAuth("/data.bak");
                if (target2 !== null) return { success: false, logs: "Duplicate target created!" };

                storage.clear();
                approvalAddCache(target);
                return { success: true, logs: "Target created and added!" };
            }
        );
    }

    return {
        name: "Connect via Redirect",
        state:
            storage.load() === "approval"
                ? { log: "Redirecting for auth...", result: approvalRedirectResult }
                : undefined,
        runner: async (logger) => {
            storage.save("approval");
            DropboxTarget.redirectForAuth(CLIENT_ID, REDIRECT_URL);

            await new Promise<void>((resolve) => setTimeout(() => resolve(), 10000));

            logger("Redirecting for auth...");
            logger("Failed to redirect!");
            return false;
        },
    };
};

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

const rejectionRedirectResult: Promise<TestResult> = DropboxTarget.catchRedirectForAuth("/data.back").then(
    async (target) => {
        if (target === null) return { logs: "No target created!", success: true };
        else return { logs: "Target created!", success: false };
    }
);
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

export const AuthTests = [
    ConnectInPopup,
    HandlePopupRejection,
    HandleEmptyRedirectCatch,
    HandlePopupBlockerDelay,
    BadToken,
    HandleRedirectRejection,
];
