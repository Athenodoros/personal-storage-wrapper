import { useState } from "react";

export function App() {
    const [count, setCount] = useState(0);

    return (
        <div className="h-screen w-screen flex justify-center bg-slate-200 py-24">
            <div className="w-[800px]">
                <h1 className="text-4xl uppercase mb-12 text-slate-400 font-light text-center">PSM Test Page</h1>
                <Division title="Dropbox" cloud={true} image="/dropbox.png">
                    <Account email="dropbox@example.com" name="Harry Potter" />
                    <div />
                </Division>
                <Division title="GDrive" cloud={true} image="/gdrive.png">
                    <Account email="gdrive@example.com" name="Hermione Granger" />
                    <div />
                </Division>
            </div>
        </div>
    );
}

const Division: React.FC<{
    title: string;
    cloud: boolean;
    image: string;
    children: [React.ReactNode, React.ReactNode];
}> = ({ title, cloud, image, children }) => (
    <div className="mt-16 border-t-2 border-slate-400 py-6 px-2">
        <div className="flex flex-row mb-2 items-center">
            <img src={image} alt={title} className="h-16 bg-slate-100 p-3 rounded-2xl mr-4" />
            <div className="flex flex-col">
                <h2 className="text-xl text-slate-400 uppercase">{cloud ? "Cloud" : "Local"}</h2>
                <h1 className="text-3xl text-slate-800 uppercase font-bold">{title}</h1>
            </div>
        </div>
        <div className="flex flex-row">
            <div className="w-32 grow-0">{children[0]}</div>
            <div className="grow">{children[1]}</div>
        </div>
    </div>
);

const Account: React.FC<{ email: string; name: string }> = ({ email, name }) => (
    <div className="">
        {email}
        {name}
    </div>
);
