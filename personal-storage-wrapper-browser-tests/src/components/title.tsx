export interface TitleProps {
    image: string;
    type: "cloud";
    name: string;
}

const HEIGHT = "h-16 mb-6 ";

export const Title: React.FC<TitleProps> = ({ image, type, name }) => (
    <div className={HEIGHT + "flex"}>
        <img src={image} alt={name} className="h-full bg-slate-800 p-3 rounded-2xl mr-4" />
        <div className="flex flex-col justify-between py-1">
            <h2 className="text-xl text-slate-400 uppercase leading-none">{type}</h2>
            <h1 className="text-3xl text-slate-800 uppercase font-bold leading-none">{name}</h1>
        </div>
    </div>
);

export const TitleReset: React.FC<{ reset: () => void }> = ({ reset }) => (
    <div className={HEIGHT + "flex justify-end items-center"}>
        <button
            className="bg-white border border-blue-600 text-blue-600 rounded-full py-1 px-6 transition hover:bg-blue-100 active:bg-blue-200"
            onClick={reset}
        >
            RESET
        </button>
    </div>
);
