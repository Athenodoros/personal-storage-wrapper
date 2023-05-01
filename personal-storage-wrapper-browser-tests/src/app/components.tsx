import { useState } from "react";

export const Division: React.FC<
    React.PropsWithChildren<{
        title: string;
        cloud: boolean;
        image: string;
        accounts: AccountType[];
    }>
> = ({ title, cloud, image, children, accounts }) => (
    <div className="mt-16 border-t-2 border-slate-400 py-6 px-2">
        <div className="flex items-center">
            <img src={image} alt={title} className="h-16 bg-slate-800 p-3 rounded-2xl mr-4" />
            <div className="flex flex-col">
                <h2 className="text-xl text-slate-400 uppercase leading-none">{cloud ? "Cloud" : "Local"}</h2>
                <h1 className="text-3xl text-slate-800 uppercase font-bold leading-none mt-2">{title}</h1>
            </div>
        </div>
        <div className="flex">
            <div className="flex-0 mr-20 w-80">
                <Heading title="Accounts" />
                {accounts.map((account) => (
                    <Account key={account.title + "-" + account.subtitle} {...account} />
                ))}
            </div>
            <div className="grow">{children}</div>
        </div>
    </div>
);

interface AccountType {
    title: string;
    subtitle: string;
    select: () => void;
    selected: boolean;
    remove: () => void;
}
const Account: React.FC<AccountType> = ({ title, subtitle, select, selected, remove }) => (
    <BasicContainer
        selected={selected}
        onClick={select}
        className={
            "py-3 border-2 transition-all hover:bg-slate-200 cursor-pointer " +
            (selected ? "hover:border-slate-900" : "hover:border-slate-400")
        }
    >
        <div className="flex flex-row items-center">
            <button
                onClick={(event) => {
                    remove();
                    event.preventDefault();
                    event.stopPropagation();
                }}
                className={
                    "text-slate-400 rounded-lg flex transition hover:bg-slate-200 active:bg-slate-400 active:text-slate-700 mx-3"
                }
            >
                <span className="material-icons">close</span>
            </button>
            <div>
                <h5 className="text-slate-600 text-sm leading-none">{subtitle}</h5>
                <h5 className="leading-none mt-1.5 font-bold">{title}</h5>
            </div>
        </div>
    </BasicContainer>
);

export const Container = <T,>({ title, then, run }: { title: string } & ActionButtonProps<T>) => (
    <BasicContainer className="flex justify-between items-center p-2">
        <h6 className="font-semibold leading-none ml-1">{title}</h6>
        <ActionButton then={then} run={run} />
    </BasicContainer>
);

const BasicContainer: React.FC<
    React.PropsWithChildren<{ selected?: boolean; className?: string; onClick?: () => void }>
> = ({ children, selected, className, onClick }) => (
    <div
        onClick={onClick}
        className={
            "bg-slate-100 rounded-lg p-1 mb-2" + (selected ? " border-slate-500 border-2 " : " ") + (className ?? "")
        }
    >
        {children}
    </div>
);

export const Heading: React.FC<{ title: string }> = ({ title }) => (
    <h6 className="font-bold uppercase text-slate-400 mb-2 mt-4">{title}</h6>
);

export const Buffer: React.FC = () => <div className="h-24 flex-none w-1" />;

interface ActionButtonProps<T> {
    run?: () => Promise<T> | undefined;
    then?: (t: T) => void | Promise<void>;
}
export const ActionButton = <T,>({ run, then }: ActionButtonProps<T>) => {
    const [clicked, setClicked] = useState(false);
    const disabled = run === undefined;

    const onClick = async () => {
        setClicked(true);
        try {
            const result = run && (await run());
            console.log(result);
            if (then) await then(result!);
            setClicked(false);
        } catch {
            setClicked(false);
        }
    };

    return (
        <button
            className={
                "text-sky-600 flex w-16 py-0.5 rounded-md " +
                (clicked
                    ? "cursor-default justify-center"
                    : disabled
                    ? "cursor-disabled justify-between pl-2 opacity-50"
                    : "justify-between pl-2 hover:bg-sky-100 active:bg-sky-600 active:text-sky-100")
            }
            onClick={clicked ? undefined : onClick}
            disabled={disabled}
        >
            {clicked ? (
                <span className="material-icons animate-spin pointer-events-none">autorenew</span>
            ) : (
                <>
                    <h6>Run</h6>
                    <span className="material-icons scale-75">arrow_forward_ios</span>
                </>
            )}
        </button>
    );
};
