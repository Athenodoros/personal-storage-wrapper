import { DropboxTarget, DropboxTargetType } from "personal-storage-wrapper";
import { TargetTypeDisplay } from "../../components/targettype";
import { TestResultsController } from "../../hooks/controllers";
import { formatDateString, useTargetState } from "../../hooks/targets";
import { getGetTestSpec } from "../tests";
import { AuthTests, getConnectViaRedirect } from "./auth";
import { OperationsTests } from "./operations";

export const DropboxTests: React.FC<{ controller: TestResultsController }> = ({
    controller: { results, update, reset },
}) => {
    const targets = useTargetState(DropboxTargetType, DropboxTarget.deserialise);
    const getTestSpec = getGetTestSpec(targets.selected, targets.add, update, results);

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
                { name: "Authentication", tests: [...AuthTests, getConnectViaRedirect(targets.add)].map(getTestSpec) },
                { name: "Operations", tests: OperationsTests.map(getTestSpec) },
            ]}
        />
    );
};

export const DropboxTestCount = AuthTests.length + 1 + OperationsTests.length;
