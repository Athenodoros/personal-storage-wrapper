import { DropboxTarget, GDriveTarget } from "personal-storage-wrapper";
import { useState } from "react";

interface AccountState {
    dropbox: DropboxTarget[];
    gdrive: GDriveTarget[];
}

const LOCAL_STORAGE_KEY = "PSW_BROWSER_TEST_STORAGE";
interface StoredState {
    dropbox: string[];
    gdrive: string[];
}

export function App() {
    const [accounts, rawSetAccounts] = useState<AccountState>(() => {
        const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (!stored) return { dropbox: [], gdrive: [] };
        const state = JSON.parse(stored) as StoredState;
        return {
            dropbox: state.dropbox.map((serialised) => DropboxTarget.deserialise(JSON.parse(serialised))),
            gdrive: state.gdrive.map((serialised) => GDriveTarget.deserialise(JSON.parse(serialised))),
        };
    });
    const setAccounts = (update: AccountState) => {
        rawSetAccounts(update);
        const state: StoredState = {
            dropbox: update.dropbox.map((target) => JSON.stringify(target.serialise())),
            gdrive: update.gdrive.map((target) => JSON.stringify(target.serialise())),
        };
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
    };

    return (
        <div className="h-screen w-screen flex flex-col items-center bg-slate-200 overflow-y-scroll">
            <Buffer />
            <div className="w-[800px]">
                <h1 className="text-4xl uppercase mb-12 text-slate-400 font-light text-center">PSM Test Page</h1>
                <Division
                    title="Dropbox"
                    cloud={true}
                    image="/dropbox.png"
                    accounts={[{ email: "dropbox@example.com", name: "Harry Potter", selected: true }]}
                >
                    <Heading title="Creation" />
                    <Container className="flex justify-between items-center p-2">
                        <h6 className="font-semibold leading-none ml-1">Connect In Popup</h6>
                        <ActionButton
                            run={() =>
                                DropboxTarget.setupInPopup("3m19g9vaop7nvrb", window.location.origin + "/dropbox-popup")
                            }
                            then={(target) => {
                                if (target)
                                    setAccounts({
                                        dropbox: accounts.dropbox.concat([target]),
                                        gdrive: accounts.gdrive,
                                    });
                            }}
                        />
                    </Container>
                    <Container className="flex justify-between items-center p-2">
                        <h6 className="font-semibold leading-none ml-1">Redirect for Auth</h6>
                        <ActionButton />
                    </Container>
                    <Container className="flex justify-between items-center p-2">
                        <h6 className="font-semibold leading-none ml-1">Catch Auth Redirect</h6>
                        <ActionButton />
                    </Container>
                    <Heading title="File Management" />
                    <Container className="flex justify-between items-center p-2">
                        <h6 className="font-semibold leading-none ml-1">Get Timestamp</h6>
                        <ActionButton />
                    </Container>
                    <Container className="flex justify-between items-center p-2">
                        <h6 className="font-semibold leading-none ml-1">Pull File</h6>
                        <ActionButton />
                    </Container>
                    <Container className="flex justify-between items-center p-2">
                        <h6 className="font-semibold leading-none ml-1">Write File</h6>
                        <ActionButton />
                    </Container>
                </Division>
                <Division
                    title="GDrive"
                    cloud={true}
                    image="/gdrive.png"
                    accounts={[{ email: "gdrive@example.com", name: "Hermione Granger", selected: true }]}
                >
                    <Heading title="Creation" />
                    <Container className="flex justify-between items-center p-2">
                        <h6 className="font-semibold leading-none ml-1">Connect In Popup</h6>
                        <ActionButton />
                    </Container>
                    <Container className="flex justify-between items-center p-2">
                        <h6 className="font-semibold leading-none ml-1">Redirect for Auth</h6>
                        <ActionButton />
                    </Container>
                    <Container className="flex justify-between items-center p-2">
                        <h6 className="font-semibold leading-none ml-1">Catch Auth Redirect</h6>
                        <ActionButton />
                    </Container>
                    <Heading title="File Management" />
                    <Container className="flex justify-between items-center p-2">
                        <h6 className="font-semibold leading-none ml-1">Get Timestamp</h6>
                        <ActionButton />
                    </Container>
                    <Container className="flex justify-between items-center p-2">
                        <h6 className="font-semibold leading-none ml-1">Pull File</h6>
                        <ActionButton />
                    </Container>
                    <Container className="flex justify-between items-center p-2">
                        <h6 className="font-semibold leading-none ml-1">Write File</h6>
                        <ActionButton />
                    </Container>
                </Division>
            </div>
            <Buffer />
        </div>
    );
}

const Division: React.FC<
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
            <div className="flex-0 mr-20">
                <Heading title="Accounts" />
                {accounts.map((account) => (
                    <Account {...account} />
                ))}
            </div>
            <div className="grow">{children}</div>
        </div>
    </div>
);

interface AccountType {
    email: string;
    name: string;
    selected: boolean;
}
const Account: React.FC<AccountType> = ({ email, name, selected }) => (
    <Container selected={selected} className="w-72 py-3">
        <div className="flex flex-row items-center">
            <button
                className={
                    "text-slate-400 rounded-lg flex transition hover:bg-slate-200 active:bg-slate-400 active:text-slate-700 mx-3"
                }
            >
                <span className="material-icons">close</span>
            </button>
            <div>
                <h5 className="text-slate-600 text-sm leading-none">{name}</h5>
                <h5 className="leading-none mt-1.5 font-bold">{email}</h5>
            </div>
        </div>
    </Container>
);

const Container: React.FC<React.PropsWithChildren<{ selected?: boolean; className?: string }>> = ({
    children,
    selected,
    className,
}) => (
    <div
        className={
            (className ?? "") + " bg-slate-100 rounded-lg p-1 mb-2" + (selected ? " border-slate-500 border-2" : "")
        }
    >
        {children}
    </div>
);

const Heading: React.FC<{ title: string }> = ({ title }) => (
    <h6 className="font-bold uppercase text-slate-400 mb-2 mt-4">{title}</h6>
);

const ActionButton = <T,>({ run, then }: { run?: () => Promise<T>; then?: (t: T) => void | Promise<void> }) => {
    const [clicked, setClicked] = useState(false);

    const onClick = async () => {
        setClicked(true);
        const result = run && (await run());
        // console.log(result);
        if (then) await then(result!);
        setClicked(false);
    };

    return (
        <button
            className={
                "text-sky-600 flex w-16 py-0.5 rounded-md " +
                (clicked
                    ? "cursor-default justify-center"
                    : "justify-between pl-2 hover:bg-sky-100 active:bg-sky-600 active:text-sky-100")
            }
            onClick={clicked ? undefined : onClick}
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

const Buffer: React.FC = () => <div className="h-24 flex-none w-1" />;
