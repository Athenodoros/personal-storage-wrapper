export interface TitleProps {
    image: string;
    type: "cloud";
    name: string;
}

const HEIGHT = "h-16 mb-2 ";

export const Title: React.FC<TitleProps> = ({ image, type, name }) => (
    <div className={HEIGHT + "flex"}>
        <img src={image} alt={name} className="h-full bg-slate-800 p-3 rounded-2xl mr-4" />
        <div className="flex flex-col justify-between py-1">
            <h2 className="text-xl text-slate-400 uppercase leading-none">{type}</h2>
            <h1 className="text-3xl text-slate-800 uppercase font-bold leading-none">{name}</h1>
        </div>
    </div>
);

export const TitleReset: React.FC<{ reset: () => void; disconnect: () => void }> = ({ reset, disconnect }) => (
    <div className={HEIGHT + "flex justify-end items-end space-x-3"}>
        <TitleResetButton
            onClick={() => {
                window.history.replaceState(null, "", window.location.origin);
                reset();
            }}
            name="Reset"
            icon="published_with_changes"
        />
        <TitleResetButton onClick={disconnect} name="Disconnect" icon="open_in_new" />
    </div>
);

const TitleResetButton: React.FC<{ onClick: () => void; name: string; icon: string }> = ({ onClick, name, icon }) => (
    <button
        className="bg-white border border-blue-600 text-blue-600 rounded-full flex items-center py-1 px-4 transition hover:bg-blue-100 active:bg-blue-200"
        onClick={onClick}
    >
        {name}
        <span className="material-icons text-base ml-2">{icon}</span>
    </button>
);
