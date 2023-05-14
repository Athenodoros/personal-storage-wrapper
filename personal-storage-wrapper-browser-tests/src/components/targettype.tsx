import { Account, AccountProps } from "./account";
import { ActionButton, Test, TestProps } from "./test";
import { Title, TitleProps, TitleReset } from "./title";

export interface TargetTypeDisplayProps {
    title: TitleProps;
    accounts: AccountProps[];
    tests: (
        | { test: TestProps }
        | { instruction: string; separate?: boolean; action?: { handler: () => void; name: string } }
    )[];
    reset: () => void;
    disconnect: () => void;
}

export const TargetTypeDisplay: React.FC<TargetTypeDisplayProps> = ({ title, accounts, tests, reset, disconnect }) => (
    <div className="bt-slate-200 border-t-2 flex pt-4 mt-12">
        <div className="w-72 mr-4">
            <Title {...title} />
            <div className="space-y-3">
                {accounts.map((account, idx) => (
                    <Account {...account} key={idx} />
                ))}
                {accounts.length === 0 ? (
                    <p className="italic text-slate-400 font-light">No targets found...</p>
                ) : undefined}
            </div>
        </div>
        <div className="grow">
            <TitleReset reset={reset} disconnect={disconnect} />
            <div className="space-y-2">
                {tests.map((testOrInstruction) => {
                    if ("test" in testOrInstruction)
                        return <Test {...testOrInstruction.test} key={testOrInstruction.test.name} />;

                    return (
                        <div
                            className={"flex italic justify-between" + (testOrInstruction.separate ? " py-4" : " pt-3")}
                        >
                            <p className="text-slate-500">{testOrInstruction.instruction}</p>
                            {testOrInstruction.action && (
                                <ActionButton
                                    onClick={testOrInstruction.action.handler}
                                    name={testOrInstruction.action.name}
                                    disabled={false}
                                    className="w-max italic bg-blue-100"
                                />
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    </div>
);
