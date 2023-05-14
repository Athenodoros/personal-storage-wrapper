import { GDriveTarget, GDriveTargetType } from "personal-storage-wrapper";
import { useEffect } from "react";
import { TargetTypeDisplay, TargetTypeDisplayProps } from "../../components/targettype";
import { TestResultsController } from "../../hooks/controllers";
import { formatDateString, useTargetState } from "../../hooks/targets";
import {
    BadToken,
    ConnectInPopup,
    HandleEmptyRedirectCatch,
    HandlePopupBlockerDelay,
    HandlePopupRejection,
    HandleRedirectRejection,
    OldToken,
    getGDriveConnectViaRedirect,
    getRefreshInRedirect,
} from "../gdrive/auth";
import { getHandleOffline, getHandleRevokedAccess, getInvalidReference, getRunOperations } from "../utils/operations";
import { getGetTestSpec } from "../utils/tests";
import { FindExistingFile, RefreshInPopup } from "./auth";

const disconnect = () =>
    window.open(
        "https://myaccount.google.com/permissions?continue=https%3A%2F%2Fmyaccount.google.com%2Fdata-and-privacy%3Fhl%3Den&hl=en"
    );

export const GDriveTests: React.FC<{ controller: TestResultsController }> = ({
    controller: { results, update, reset, setCount },
}) => {
    const targets = useTargetState(GDriveTargetType, GDriveTarget.deserialise);
    const getTestSpec = getGetTestSpec<GDriveTarget>(targets, update, results);

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
        getTestSpec(getGDriveConnectViaRedirect(targets.add)),
        getTestSpec(getRunOperations(false)),
        getTestSpec(getInvalidReference((serialised) => (serialised.file.id = "BAD_FILE"), GDriveTarget.deserialise)),
        getTestSpec(RefreshInPopup),
        getTestSpec(getRefreshInRedirect(targets.accounts.map(({ target }) => target))),

        { instruction: "Enable popups", separate: true },

        getTestSpec(FindExistingFile),

        { instruction: "Disable popups", separate: true },
        getTestSpec(HandlePopupBlockerDelay),

        { instruction: "Disable internet connection and refresh page", separate: true },
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
                image: "/gdrive.png",
                type: "cloud",
                name: "GDrive",
            }}
            accounts={targets.accounts.map(({ timestamp, target }) => ({
                selected: target === targets.selected,
                select: () => targets.set(target),
                timestamp,
                remove: () => targets.remove(target),
                values: [
                    ["Token Expiry", formatDateString((target as any).connection.expiry)],
                    ["Use App Data", "" + (target as any).connection.useAppData],
                    [
                        "Scopes",
                        (target as any).connection.scopes
                            .map((scope: string) => scope.replace(/^https:\/\/www\.googleapis\.com\/auth\//, ""))
                            .join(", "),
                    ],
                    ["File", target.file.id],
                    ["MIME Type", target.file.mime],
                ],
            }))}
            tests={tests}
        />
    );
};
