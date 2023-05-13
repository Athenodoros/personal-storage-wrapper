import { createContext, useContext, useEffect, useState } from "react";
import { IconButton } from "./button";

export type TestName = string;

export interface TestResult {
    success: boolean;
    logs: string;
}

export interface TestProps {
    name: TestName;
    disabled: boolean;
    result: TestResult | undefined;
    runner?: (logger: (line: string) => void) => Promise<boolean>;
    update: (result: TestResult | undefined) => void;
}

const noop = (): void => void null;
export const TestRunningContext = createContext({ increase: noop, decrease: noop });

export const Test = ({ name, disabled, result, runner, update }: TestProps) => {
    const [open, setOpen] = useState(false);
    const [runLogs, setRunLogs] = useState<null | string>(null);

    const running = runLogs !== null;
    useEffect(() => {
        if (result === undefined && runLogs === null) setOpen(false);
    }, [result]);

    const context = useContext(TestRunningContext);

    const run = async () => {
        if (running || runner === undefined) return;

        update(undefined);
        context.increase();

        let logs = "";
        setRunLogs(logs);

        const success = await runner((log) => {
            logs += (logs === "" ? "" : "\n") + log;
            setOpen(true);
            setRunLogs(logs);
        });

        update({ success, logs });
        context.decrease();
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
                <button
                    disabled={disabled || running || runner === undefined}
                    onClick={(event) => {
                        if (!disabled && !running) run();
                        event.preventDefault();
                        event.stopPropagation();
                    }}
                    className={
                        "bg-blue-50 flex rounded-lg pl-2 transition w-16 " +
                        (running || runner === undefined || disabled
                            ? "text-blue-200 justify-center"
                            : "text-blue-600 hover:bg-blue-100 active:bg-blue-200 active:text-blue-700")
                    }
                >
                    {running ? (
                        <span className="material-icons animate-spin pointer-events-none">autorenew</span>
                    ) : (
                        <>
                            <p>RUN</p>
                            <span className="material-icons">chevron_right</span>
                        </>
                    )}
                </button>
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
