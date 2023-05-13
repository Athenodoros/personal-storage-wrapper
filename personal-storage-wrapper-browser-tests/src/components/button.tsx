export const IconButton: React.FC<{
    disabled?: boolean;
    onClick: () => void;
    icon: string;
    className?: string;
    innerClassName?: string;
}> = ({ disabled, onClick, icon, className, innerClassName }) => (
    <button
        disabled={disabled}
        onClick={(event) => {
            onClick();
            event.preventDefault();
            event.stopPropagation();
        }}
        className={
            (disabled
                ? "text-slate-200"
                : "text-slate-400 hover:bg-slate-200 active:bg-slate-400 active:text-slate-700") +
            " flex transition " +
            (className ?? "")
        }
    >
        <span className={"material-icons " + (innerClassName ?? "")}>{icon}</span>
    </button>
);
