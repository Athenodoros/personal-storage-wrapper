import { DefaultTarget } from "personal-storage-wrapper";
import { TestResult } from "../../components/test";
import { getStorageManager } from "../../utils/storage";
import { TestConfig } from "./tests";

export const getConnectInPopup = <T extends DefaultTarget>(open: () => Promise<T | null>): TestConfig<T> => ({
    name: "Connect in Popup",
    runner: async (logger, _, addTarget) => {
        logger("Opening Popup...");
        const target = await open();

        if (target === null) {
            logger("No target created!");
            return false;
        }

        logger("Target created and added!");
        addTarget(target);
        return true;
    },
});

export const getGetConnectViaRedirect = <T extends DefaultTarget>(
    name: string,
    redirect: () => void,
    handle: () => Promise<T | null>
) => {
    const storage = getStorageManager<"approval">(name + "-load-behaviour-approval");

    let approvalAddCache: (target: T) => void;
    let approvalRedirectResult: Promise<TestResult> | null = null;

    return (add: (target: T) => void): TestConfig<T> => {
        approvalAddCache = add;

        if (approvalRedirectResult === null && storage.load() === "approval") {
            approvalRedirectResult = handle().then(async (target): Promise<TestResult> => {
                storage.clear();
                console.log(target);

                if (target === null) return { success: false, logs: "No target created!" };

                const target2 = await handle();
                if (target2 !== null) return { success: false, logs: "Duplicate target created!" };

                approvalAddCache(target);
                return { success: true, logs: "Target created and added!" };
            });
        }

        return {
            name: "Connect via Redirect",
            state:
                storage.load() === "approval" && approvalRedirectResult
                    ? { log: "Redirecting for auth...", result: approvalRedirectResult }
                    : undefined,
            runner: async (logger) => {
                storage.save("approval");
                redirect();

                await new Promise<void>((resolve) => setTimeout(() => resolve(), 10000));

                logger("Redirecting for auth...");
                logger("Failed to redirect!");
                return false;
            },
        };
    };
};
