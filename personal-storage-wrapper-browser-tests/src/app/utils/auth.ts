import { DefaultTarget } from "personal-storage-wrapper";
import { TestResult } from "../../components/test";
import { getStorageManager } from "../../utils/storage";
import { TestConfig } from "./tests";

export const getGetConnectViaRedirect = <T extends DefaultTarget>(
    type: T["type"],
    redirect: () => void,
    handle: () => Promise<T | null>,
    expectDupe: boolean
) => {
    const storage = getStorageManager<"approval">(type + "-load-behaviour-approval");

    // This indirection is so that the test is only triggered once in react strict dev mode
    // It should start the redirect catch handler when first called, but only use the final "add" function
    let approvalAddCache: (target: T) => void;
    let approvalRedirectResult: Promise<TestResult> | null = null;

    return (add: (target: T) => void): TestConfig<T> => {
        approvalAddCache = add;

        if (approvalRedirectResult === null && storage.load() === "approval") {
            approvalRedirectResult = handle().then(async (target): Promise<TestResult> => {
                // It's not obvious to me why the timeout is necessary
                // I think that the vite dev server might be refreshing the page very quickly,
                //  causing the localStorage to be cleared but the target not to be saved
                setTimeout(() => {
                    storage.clear();
                    window.history.replaceState(null, "", window.location.origin);
                }, 1000);

                if (target === null) return { success: false, logs: "No target created!" };

                const target2 = await handle();

                if (!expectDupe && target2 !== null) return { success: false, logs: "Duplicate target created!" };
                if (expectDupe && target2 === null) return { success: false, logs: "No duplicate target created!" };

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

export const runTargetCreation =
    <T extends DefaultTarget>(
        open: () => Promise<T | null>,
        log: string,
        expectTarget: boolean
    ): TestConfig<T>["runner"] =>
    async (logger, _, addTarget) => {
        logger(log);
        const target = await open();

        if (target === null) {
            logger("No target created!");
            return !expectTarget;
        }

        logger("Target created and added!");
        if (expectTarget) addTarget(target);
        else console.log(target);
        return expectTarget;
    };

export const getHandleRedirectRejection = <T extends DefaultTarget>(
    type: T["type"],
    redirect: () => void,
    handle: () => Promise<T | null>
): TestConfig<T> => {
    const storage = getStorageManager<"rejection">(type + "-load-behaviour-rejection");

    // This indirection is so that the test is only triggered once in react strict dev mode
    // It should start the redirect catch handler when first called, but only run once
    const rejectionRedirectResult: Promise<TestResult> =
        storage.load() === "rejection"
            ? handle().then(async (target) => {
                  storage.clear();
                  window.history.replaceState(null, "", window.location.origin);

                  if (target === null) return { logs: "No target created!", success: true };
                  else return { logs: "Target created!", success: false };
              })
            : Promise.resolve({ logs: "", success: false });

    return {
        name: "Handle Redirect Rejection",
        state:
            storage.load() === "rejection"
                ? { log: "Redirecting for auth...", result: rejectionRedirectResult }
                : undefined,
        runner: async (logger) => {
            storage.save("rejection");
            redirect();

            await new Promise<void>((resolve) => setTimeout(() => resolve(), 10000));

            logger("Redirecting for auth...");
            logger("Failed to redirect!");
            return false;
        },
    };
};

export const getHandlePopupBlockerDelay = <T extends DefaultTarget>(
    type: T["type"],
    popup: () => Promise<T | null>
): TestConfig<T> => {
    const storage = getStorageManager<"popup">(type + "-load-behaviour-popup");

    return {
        name: "Handle Popup Blocker Delay",
        state:
            storage.load() === "popup"
                ? {
                      log: "Refreshing for popup test...",
                      result: popup().then((target) => {
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
};
