import { IconButton } from "./button";

export interface AccountProps {
    selected: boolean;
    select: () => void;
    timestamp: string;
    remove: () => void;
    values: [string, string][];
}

export const Account: React.FC<AccountProps> = ({ selected, select, timestamp, remove, values }) => (
    <div
        onClick={select}
        className={
            "bg-white p-3 pl-4 flex flex-col rounded-2xl space-y-0.5 border-2 transition-all cursor-pointer" +
            (selected ? " border-slate-500 hover:border-slate-900" : " border-white hover:border-slate-300")
        }
    >
        <div className="flex justify-between items-center mb-1">
            <h6 className="text-l font-bold truncate">{timestamp}</h6>
            <IconButton onClick={remove} icon="close" className="scale-80 ml-2 rounded-lg" />
        </div>
        {values.map(([key, value]) => (
            <div className="text-slate-600 flex text-sm" key={key}>
                <p className="font-bold">{key}</p>
                <p className="truncate">: {value}</p>
            </div>
        ))}
    </div>
);
