import { DropboxTarget, DropboxTargetType } from "personal-storage-wrapper";
import { TargetTypeDisplay } from "../../components/targettype";
import { TestProps, TestResult } from "../../components/test";
import { TestResultsController } from "../../hooks/controllers";
import { formatDateString, useTargetState } from "../../hooks/targets";
import { AuthTests, getConnectViaRedirect } from "./auth";
import { OperationsTests } from "./operations";
import { DropboxTest } from "./types";

export const DropboxTests: React.FC<{ controller: TestResultsController }> = ({
    controller: { results, update, reset },
}) => {
    const targets = useTargetState(DropboxTargetType, DropboxTarget.deserialise);

    const getTestSpec = ({ name, disabled, runner, state }: DropboxTest): TestProps => ({
        name,
        disabled: disabled ? disabled(targets.selected) : false,
        result: results[name],
        update: (result: TestResult | undefined) => update(name, result),
        runner: runner && ((logger) => runner(logger, targets.selected, targets.add)),
        state,
    });

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
