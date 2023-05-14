import { useRef, useState } from "react";
import { Header } from "../components/header";
import { TestRunningContext } from "../components/test";
import { useTestResultsController } from "../hooks/controllers";
import { DropboxTests } from "./dropbox";
import { GDriveTests } from "./gdrive";

export const App: React.FC = () => {
    const dropbox = useTestResultsController("dropbox");
    const gdrive = useTestResultsController("gdrive");

    const [running, setRunning] = useState(new Set<string>());
    const runningRef = useRef(running);
    const setAsRunning = (target: string, name: string) => {
        runningRef.current = new Set([...runningRef.current.values(), target + "-" + name]);
        setRunning(runningRef.current);
    };
    const setAsStopped = (target: string, name: string) => {
        runningRef.current = new Set(runningRef.current);
        runningRef.current.delete(target + "-" + name);
        setRunning(runningRef.current);
    };

    const { success, failed } = Object.values(dropbox.results)
        .concat(Object.values(gdrive.results))
        .reduce(
            ({ success, failed }, val) =>
                val
                    ? {
                          success: success + (val.success ? 1 : 0),
                          failed: failed + (val.success ? 0 : 1),
                      }
                    : { success, failed },
            { success: 0, failed: 0 }
        );

    return (
        <div className="h-screen w-screen flex flex-col items-center bg-slate-100 overflow-y-scroll">
            <div className="w-[800px] pb-48">
                {dropbox.count && gdrive.count ? (
                    <Header
                        success={success}
                        running={running.size}
                        failed={failed}
                        total={dropbox.count + gdrive.count}
                        reset={() => (dropbox.reset(), gdrive.reset())}
                    />
                ) : (
                    <Header
                        success={0}
                        running={0}
                        failed={0}
                        total={1}
                        reset={() => (dropbox.reset(), gdrive.reset())}
                    />
                )}
                <TestRunningContext.Provider value={{ setAsRunning, setAsStopped }}>
                    <DropboxTests controller={dropbox} />
                    <GDriveTests controller={gdrive} />
                </TestRunningContext.Provider>
            </div>
        </div>
    );
};
