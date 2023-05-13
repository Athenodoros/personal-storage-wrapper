import { DefaultTarget } from "personal-storage-wrapper";
import { ReactNode, createContext, useContext, useEffect, useState } from "react";
import { IconButton } from "./button";

export type TestName = string;

export interface TestResult {
    success: boolean;
    logs: string;
}

export interface TestProps {
    target: DefaultTarget["type"];
    name: TestName;
    disabled: boolean;
    result: TestResult | undefined;
    runner?: (logger: (line: string) => void) => Promise<boolean>;
    update: (result: TestResult | undefined) => void;
    state?: { log: string; result: Promise<TestResult> };
}

const noop = (_target: string, _name: string): void => void null;
export const TestRunningContext = createContext({ setAsRunning: noop, setAsStopped: noop });

export const Test = ({ target, name, disabled, result, runner, update, state }: TestProps) => {
    const [open, setOpen] = useState(state !== undefined);
    const [runLogs, setRunLogs] = useState<null | string>(state?.log ?? null);

    const running = runLogs !== null;
    useEffect(() => {
        if (result === undefined && runLogs === null) setOpen(false);
    }, [result]);

    const context = useContext(TestRunningContext);

    useEffect(() => {
        if (!state) return;

        context.setAsRunning(target, name);
        state.result.then((result) => {
            update({ success: result.success, logs: runLogs + "\n" + result.logs });
            context.setAsStopped(target, name);
            setRunLogs(null);
            if (result.success) setOpen(false);
        });
    }, []);

    const run = async () => {
        if (running || runner === undefined) return;

        update(undefined);
        context.setAsRunning(target, name);

        let logs = "";
        setRunLogs(logs);

        const success = await runner((log) => {
            logs += (logs === "" ? "" : "\n") + log;
            setOpen(true);
            setRunLogs(logs);
        });

        update({ success, logs });
        context.setAsStopped(target, name);
        setRunLogs(null);
        if (!open) setOpen(false);
    };

    return (
        <div className={"bg-white rounded-3xl w-full p-3 flex flex-col items-stretch"}>
            <div className="flex items-center">
                <span
                    className={
                        "material-icons-two-tone w-6 h-6 mr-3 text-transparent bg-clip-text " +
                        (!result ? "bg-slate-300" : result.success ? "bg-green-600" : "bg-red-600")
                    }
                >
                    {!result ? "add_circle" : result.success ? "check_circle" : "highlight_off"}
                </span>
                <ActionButton
                    disabled={disabled || running || runner === undefined}
                    name="RUN"
                    onClick={run}
                    contents={
                        running ? (
                            <span className="material-icons animate-spin pointer-events-none">autorenew</span>
                        ) : undefined
                    }
                />
                <h6 className={"ml-4 grow " + (runner ? "" : "font-light text-slate-400")}>{name}</h6>
                <IconButton
                    disabled={!result?.logs && !running}
                    onClick={() => setOpen(!open)}
                    icon={open ? "expand_less" : "expand_more"}
                    className="rounded-full w-6"
                />
            </div>
            {(runLogs ?? result) && open ? (
                <pre className="mt-3 py-2 px-3 bg-stone-100 rounded-xl text-sm">{runLogs ?? result?.logs ?? ""}</pre>
            ) : undefined}
        </div>
    );
};

const ActionButton: React.FC<{ disabled: boolean; onClick: () => void; name: string; contents?: ReactNode }> = ({
    disabled,
    onClick,
    name,
    contents,
}) => (
    <button
        disabled={disabled}
        onClick={(event) => {
            if (!disabled) onClick();
            event.preventDefault();
            event.stopPropagation();
        }}
        className={
            "bg-blue-50 flex rounded-lg pl-2 transition w-16 " +
            (disabled
                ? "text-blue-200 justify-center"
                : "text-blue-600 hover:bg-blue-100 active:bg-blue-200 active:text-blue-700")
        }
    >
        {contents ?? (
            <>
                <p>{name}</p>
                <span className="material-icons">chevron_right</span>
            </>
        )}
    </button>
);
