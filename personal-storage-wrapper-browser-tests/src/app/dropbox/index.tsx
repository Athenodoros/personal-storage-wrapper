import { DropboxTarget, DropboxTargetType } from "personal-storage-wrapper";
import { TargetTypeDisplay } from "../../components/targettype";
import { TestResult } from "../../components/test";
import { TestResultsController } from "../../hooks/controllers";
import { formatDateString, useTargetState } from "../../hooks/targets";
import {
    BadToken,
    ConnectInPopup,
    ConnectViaRedirect,
    HandleEmptyRedirectCatch,
    HandlePopupBlockerDelay,
    HandlePopupRejection,
    HandleRedirectRejection,
} from "./auth";
import { HandleOffline, HandleRevokedAccess, InvalidPath, OldToken, RunOperations } from "./operations";
import { DropboxTest } from "./types";

const tests: DropboxTest[] = [
    // Auth
    ConnectInPopup,
    ConnectViaRedirect,
    HandlePopupRejection,
    HandleRedirectRejection,
    HandleEmptyRedirectCatch,
    HandlePopupBlockerDelay,
    BadToken,

    // Normal Operations
    RunOperations,
    OldToken,
    HandleRevokedAccess,
    HandleOffline,
    InvalidPath,
];

export const DropboxTests: React.FC<{ controller: TestResultsController }> = ({
    controller: { results, update, reset },
}) => {
    const targets = useTargetState(DropboxTargetType, DropboxTarget.deserialise);

    return (
        <TargetTypeDisplay
            reset={reset}
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
            tests={tests.map(({ name, disabled, runner }) => ({
                name,
                disabled: disabled ? disabled(targets.selected) : false,
                result: results[name],
                update: (result: TestResult | undefined) => update(name, result),
                runner: runner && ((logger) => runner(logger, targets.selected, targets.add)),
            }))}
        />
    );
};

export const DropboxTestCount = tests.length;
