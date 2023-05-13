import { GDriveTarget, GDriveTargetType } from "personal-storage-wrapper";
import { TargetTypeDisplay } from "../../components/targettype";
import { TestResultsController } from "../../hooks/controllers";
import { formatDateString, useTargetState } from "../../hooks/targets";
import { getGetTestSpec } from "../utils/tests";
import { GDriveAuthTests, getGDriveConnectViaRedirect } from "./auth";
import { GDriveOperationsTests } from "./operations";

export const GDriveTests: React.FC<{ controller: TestResultsController }> = ({
    controller: { results, update, reset },
}) => {
    const targets = useTargetState(GDriveTargetType, GDriveTarget.deserialise);
    const getTestSpec = getGetTestSpec("gdrive", targets.selected, targets.add, update, results);

    return (
        <TargetTypeDisplay
            reset={reset}
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
                    ["Use App Data", (target as any).connection.useAppData],
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
            groups={[
                {
                    name: "Authentication",
                    tests: [...GDriveAuthTests, getGDriveConnectViaRedirect(targets.add)].map(getTestSpec),
                },
                { name: "Operations", tests: GDriveOperationsTests.map(getTestSpec) },
            ]}
        />
    );
};

export const GDriveTestCount = GDriveAuthTests.length + 1 + GDriveOperationsTests.length;
