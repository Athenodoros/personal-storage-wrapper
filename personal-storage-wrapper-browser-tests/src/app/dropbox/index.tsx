import { DropboxTarget, DropboxTargetType } from "personal-storage-wrapper";
import { useEffect } from "react";
import { TargetTypeDisplay, TargetTypeDisplayProps } from "../../components/targettype";
import { TestResultsController } from "../../hooks/controllers";
import { formatDateString, useTargetState } from "../../hooks/targets";
import { getHandleOffline, getHandleRevokedAccess, getInvalidReference, getRunOperations } from "../utils/operations";
import { getGetTestSpec } from "../utils/tests";
import {
    BadToken,
    ConnectInPopup,
    HandleEmptyRedirectCatch,
    HandlePopupBlockerDelay,
    HandlePopupRejection,
    HandleRedirectRejection,
    OldToken,
    getDropboxConnectViaRedirect,
} from "./auth";

const disconnect = () => window.open("https://www.dropbox.com/account/connected_apps");

export const DropboxTests: React.FC<{ controller: TestResultsController }> = ({
    controller: { results, update, reset, setCount },
}) => {
    const targets = useTargetState(DropboxTargetType, DropboxTarget.deserialise);
    const getTestSpec = getGetTestSpec<DropboxTarget>(targets, update, results);

    const tests: TargetTypeDisplayProps["tests"] = [
        getTestSpec(BadToken),
        getTestSpec(HandleEmptyRedirectCatch),

        { instruction: "Reject connection attempts" },
        getTestSpec(HandlePopupRejection),
        getTestSpec(HandleRedirectRejection),

        { instruction: "Approve connection attempt" },
        getTestSpec(ConnectInPopup),

        { instruction: "Revoke access", separate: true, action: { handler: disconnect, name: "Go To" } },

        getTestSpec(getHandleRevokedAccess()),

        {
            instruction: "Remove broken target",
            separate: true,
            action: { name: "Remove", handler: () => targets.selected && targets.remove(targets.selected) },
        },
        getTestSpec(getDropboxConnectViaRedirect(targets.add)),
        getTestSpec(getRunOperations(true)),
        getTestSpec(getInvalidReference((serialised) => (serialised.path = "//"), DropboxTarget.deserialise)),

        { instruction: "Ensure popups are disabled", separate: true },
        getTestSpec(HandlePopupBlockerDelay),

        { instruction: "Disable internet connection and refresh", separate: true },
        getTestSpec(getHandleOffline()),

        { instruction: "Enable internet connection, and wait for disabled token", separate: true },
        getTestSpec(OldToken),
    ];

    const testCount = tests.filter((test) => "test" in test).length;
    useEffect(() => setCount(testCount), [setCount, testCount]);

    return (
        <TargetTypeDisplay
            reset={() => {
                reset();
                targets.reset();
            }}
            disconnect={disconnect}
            title={{
                image: "/dropbox.png",
                type: "cloud",
                name: "Dropbox",
            }}
            accounts={targets.accounts.map(({ timestamp, target }) => ({
                selected: target === targets.selected,
                select: () => targets.set(target),
                timestamp,
                remove: () => targets.remove(target),
                values: [
                    ["Token Expiry", formatDateString((target as any).connection.expiry)],
                    ["Path", (target as any).path],
                ],
            }))}
            tests={tests}
        />
    );
};

export let DropboxTestCount: number | undefined = undefined;
