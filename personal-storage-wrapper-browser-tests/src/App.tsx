import { DropboxTarget, GDriveTarget } from "personal-storage-wrapper";
import { useState } from "react";
import {
    decodeFromArrayBuffer,
    encodeToArrayBuffer,
} from "../../personal-storage-wrapper/src/utilities/buffers/encoding";

interface AccountState {
    dropbox: {
        id: string;
        target: DropboxTarget;
    }[];
    gdrive: {
        id: string;
        target: GDriveTarget;
    }[];
}

const LOCAL_STORAGE_KEY = "PSW_BROWSER_TEST_STORAGE";
interface StoredState {
    dropbox: {
        id: string;
        target: string;
    }[];
    gdrive: {
        id: string;
        target: string;
    }[];
}

const file = encodeToArrayBuffer("Hello, World!");

export function App() {
    const [accounts, rawSetAccounts] = useState<AccountState>(() => {
        const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (!stored) return { dropbox: [], gdrive: [] };
        const state = JSON.parse(stored) as StoredState;
        return {
            dropbox: state.dropbox.map((serialised) => ({
                id: serialised.id,
                target: DropboxTarget.deserialise(JSON.parse(serialised.target)),
            })),
            gdrive: state.gdrive.map((serialised) => ({
                id: serialised.id,
                target: GDriveTarget.deserialise(JSON.parse(serialised.target)),
            })),
        };
    });

    const [selectedDropbox, setSelectedDropbox] = useState<DropboxTarget | undefined>(accounts.dropbox[0]?.target);
    const [selectedGDrive, setSelectedGDrive] = useState<GDriveTarget | undefined>(accounts.gdrive[0]?.target);

    const setAccounts = (updated: AccountState) => {
        rawSetAccounts(updated);
        const state: StoredState = {
            dropbox: updated.dropbox.map(({ id, target }) => ({ id, target: JSON.stringify(target.serialise()) })),
            gdrive: updated.gdrive.map(({ id, target }) => ({ id, target: JSON.stringify(target.serialise()) })),
        };
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
    };

    const addDropbox = (target: DropboxTarget | null) => {
        if (!target) return;

        if (!selectedDropbox) setSelectedDropbox(target);

        setAccounts({
            dropbox: accounts.dropbox.concat([{ id: getDateString(), target }]),
            gdrive: accounts.gdrive,
        });
    };

    const removeDropbox = (target: DropboxTarget) => () => {
        if (selectedDropbox === target) setSelectedDropbox(undefined);

        setAccounts({
            dropbox: accounts.dropbox.filter((candidate) => target !== candidate.target),
            gdrive: accounts.gdrive,
        });
    };

    const removeGDrive = (target: GDriveTarget) => () => {
        if (selectedGDrive === target) setSelectedGDrive(undefined);

        setAccounts({
            dropbox: accounts.dropbox,
            gdrive: accounts.gdrive.filter((candidate) => target !== candidate.target),
        });
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
                    accounts={accounts.dropbox.map(({ id, target }) => ({
                        subtitle: target.user.email,
                        title: id,
                        select: () => setSelectedDropbox(target),
                        selected: target === selectedDropbox,
                        remove: removeDropbox(target),
                    }))}
                >
                    <Heading title="Creation" />
                    <Container className="flex justify-between items-center p-2">
                        <h6 className="font-semibold leading-none ml-1">Connect In Popup</h6>
                        <ActionButton
                            then={(target) => void (target && addDropbox(target))}
                            run={() =>
                                DropboxTarget.setupInPopup(
                                    "3m19g9vaop7nvrb",
                                    window.location.origin + "/dropbox-popup",
                                    "/data.json.tgz"
                                )
                            }
                        />
                    </Container>
                    <Container className="flex justify-between items-center p-2">
                        <h6 className="font-semibold leading-none ml-1">Redirect for Auth</h6>
                        <ActionButton
                            run={() =>
                                DropboxTarget.redirectForAuth(
                                    "3m19g9vaop7nvrb",
                                    window.location.origin + "/dropbox-redirect"
                                )
                            }
                        />
                    </Container>
                    <Container className="flex justify-between items-center p-2">
                        <h6 className="font-semibold leading-none ml-1">Catch Auth Redirect</h6>
                        <ActionButton
                            then={addDropbox}
                            run={() => {
                                const promise = DropboxTarget.catchRedirectForAuth("/data.json.tgz");
                                window.history.replaceState(null, "", window.location.origin);
                                return promise;
                            }}
                        />
                    </Container>
                    <Heading title="File Management" />
                    <Container className="flex justify-between items-center p-2">
                        <h6 className="font-semibold leading-none ml-1">Get Timestamp</h6>
                        <ActionButton run={selectedDropbox && selectedDropbox.timestamp} />
                    </Container>
                    <Container className="flex justify-between items-center p-2">
                        <h6 className="font-semibold leading-none ml-1">Pull File</h6>
                        <ActionButton
                            run={
                                selectedDropbox &&
                                (() =>
                                    selectedDropbox.read().map(
                                        (value) =>
                                            value && {
                                                timestamp: value.timestamp,
                                                value: decodeFromArrayBuffer(value.buffer),
                                            }
                                    ))
                            }
                        />
                    </Container>
                    <Container className="flex justify-between items-center p-2">
                        <h6 className="font-semibold leading-none ml-1">Write File</h6>
                        <ActionButton run={selectedDropbox && (() => selectedDropbox.write(file))} />
                    </Container>
                </Division>
                <Division
                    title="GDrive"
                    cloud={true}
                    image="/gdrive.png"
                    accounts={accounts.gdrive.map(({ id, target }) => ({
                        subtitle: target.user.email,
                        title: id,
                        select: () => setSelectedGDrive(target),
                        selected: target === selectedGDrive,
                        remove: removeGDrive(target),
                    }))}
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

const getDateString = () => {
    const date = new Date();
    return `${date.toLocaleString("default", {
        month: "long",
    })} ${date.getDate()}, ${date.getHours()}:${date.getMinutes()}`;
};

interface AccountType {
    title: string;
    subtitle: string;
    select: () => void;
    selected: boolean;
    remove: () => void;
}
const Account: React.FC<AccountType> = ({ title, subtitle, select, selected, remove }) => (
    <Container
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
    </Container>
);

const Container: React.FC<
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

const Heading: React.FC<{ title: string }> = ({ title }) => (
    <h6 className="font-bold uppercase text-slate-400 mb-2 mt-4">{title}</h6>
);

const ActionButton = <T,>({ run, then }: { run?: () => Promise<T>; then?: (t: T) => void | Promise<void> }) => {
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

const Buffer: React.FC = () => <div className="h-24 flex-none w-1" />;
