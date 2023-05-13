import { useRef, useState } from "react";
import { Header } from "../components/header";
import { TestRunningContext } from "../components/test";
import { useTestResultsController } from "../hooks/controllers";
import { DropboxTestCount, DropboxTests } from "./dropbox";
import { GDriveTestCount, GDriveTests } from "./gdrive";

export const App: React.FC = () => {
    const dropbox = useTestResultsController("dropbox");
    const gdrive = useTestResultsController("gdrive");

    const [running, setRunning] = useState(0);
    const runningRef = useRef(running);
    const increase = () => {
        runningRef.current += 1;
        setRunning(runningRef.current);
    };
    const decrease = () => {
        runningRef.current -= 1;
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
                <Header
                    success={success}
                    running={running}
                    failed={failed}
                    total={DropboxTestCount + GDriveTestCount}
                    reset={() => (dropbox.reset(), gdrive.reset())}
                />
                <TestRunningContext.Provider value={{ increase, decrease }}>
                    <DropboxTests controller={dropbox} />
                    <GDriveTests controller={gdrive} />
                </TestRunningContext.Provider>
            </div>
        </div>
    );
};
