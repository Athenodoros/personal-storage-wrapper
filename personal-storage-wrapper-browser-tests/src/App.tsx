import { useState } from "react";

export function App() {
    const [count, setCount] = useState(0);

    return (
        <div className="h-screen w-screen flex justify-center bg-slate-200 py-24">
            <div className="w-[800px]">
                <h1 className="text-4xl uppercase mb-12 text-slate-400 font-light text-center">PSM Test Page</h1>
                <Division
                    title="Dropbox"
                    cloud={true}
                    image="/dropbox.png"
                    accounts={[{ email: "dropbox@example.com", name: "Harry Potter", selected: true }]}
                >
                    <h6 className="font-bold uppercase">Creation</h6>
                </Division>
                <Division
                    title="GDrive"
                    cloud={true}
                    image="/gdrive.png"
                    accounts={[{ email: "gdrive@example.com", name: "Hermione Granger", selected: true }]}
                >
                    <div />
                </Division>
            </div>
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
        <div className="flex flex-row mb-4 items-center">
            <img src={image} alt={title} className="h-16 bg-slate-800 p-3 rounded-2xl mr-4" />
            <div className="flex flex-col">
                <h2 className="text-xl text-slate-400 uppercase leading-none">{cloud ? "Cloud" : "Local"}</h2>
                <h1 className="text-3xl text-slate-800 uppercase font-bold leading-none mt-2">{title}</h1>
            </div>
        </div>
        <div className="flex flex-row">
            <div className="flex-0 mr-32">
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
    <div className={"bg-slate-100 w-80 rounded-lg p-1 py-3" + (selected ? " border-slate-500 border-2" : "")}>
        <div className="flex flex-row items-center">
            <button
                className={
                    "text-slate-400 rounded-lg flex transition hover:bg-slate-200 active:bg-slate-400 active:text-slate-700 mx-3"
                }
            >
                <span className="material-icons">close</span>
            </button>
            <div>
                <h5 className="text-slate-400 text-sm leading-none">{name}</h5>
                <h5 className="leading-none mt-1.5 font-bold">{email}</h5>
            </div>
        </div>
    </div>
);
