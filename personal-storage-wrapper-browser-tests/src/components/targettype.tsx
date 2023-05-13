import { Account, AccountProps } from "./account";
import { Test, TestProps } from "./test";
import { Title, TitleProps, TitleReset } from "./title";

interface TargetTypeDisplayProps {
    title: TitleProps;
    accounts: AccountProps[];
    tests: TestProps[];
    reset: () => void;
}

export const TargetTypeDisplay: React.FC<TargetTypeDisplayProps> = ({ title, accounts, tests, reset }) => (
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
            <TitleReset reset={reset} />
            <div className="space-y-3">
                {tests.map((test) => (
                    <Test {...test} key={test.name} />
                ))}
            </div>
        </div>
    </div>
);
