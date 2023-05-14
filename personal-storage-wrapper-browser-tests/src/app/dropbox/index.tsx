import { DropboxTarget, DropboxTargetType } from "personal-storage-wrapper";
import { TargetTypeDisplay } from "../../components/targettype";
import { TestResultsController } from "../../hooks/controllers";
import { formatDateString, useTargetState } from "../../hooks/targets";
import { getGetTestSpec } from "../utils/tests";
import { DropboxAuthTests, getDropboxConnectViaRedirect } from "./auth";
import { DropboxOperationsTests } from "./operations";

export const DropboxTests: React.FC<{ controller: TestResultsController }> = ({
    controller: { results, update, reset },
}) => {
    const targets = useTargetState(DropboxTargetType, DropboxTarget.deserialise);
    const getTestSpec = getGetTestSpec<DropboxTarget>(targets, update, results);

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
            groups={[
                {
                    name: "Authentication",
                    tests: [...DropboxAuthTests, getDropboxConnectViaRedirect(targets.add)].map(getTestSpec),
                },
                { name: "Operations", tests: DropboxOperationsTests.map(getTestSpec) },
            ]}
        />
    );
};

export const DropboxTestCount = DropboxAuthTests.length + 1 + DropboxOperationsTests.length;
