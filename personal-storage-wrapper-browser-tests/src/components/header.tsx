interface HeaderProps {
    success: number;
    running: number;
    failed: number;
    total: number;
    reset: () => void;
}

export const Header: React.FC<HeaderProps> = ({ success, running, failed, total, reset }) => {
    const successW = (success / total) * 100;
    const runningW = (running / total) * 100;
    const failedW = (failed / total) * 100;

    return (
        <div className="bg-slate-100 flex flex-col items-center">
            <h1 className="text-4xl uppercase mb-6 text-slate-600 font-light text-center pt-12">
                PSM Browser Test Page
            </h1>
            <div className="w-full bg-white h-5 rounded-full overflow-hidden relative">
                <div
                    className="bg-green-500 transition-all absolute h-full"
                    style={{ left: 0, width: successW + "%" }}
                />
                <div
                    className="bg-slate-500 animate-pulse transition-all absolute h-full"
                    style={{ left: successW + "%", width: runningW + "%" }}
                />
                <div
                    className="bg-red-500 transition-all absolute h-full"
                    style={{ left: successW + runningW + "%", width: failedW + "%" }}
                />
            </div>
            <button
                className="bg-white border border-blue-600 mt-3 text-blue-600 rounded-full py-2 px-6 transition hover:bg-blue-100 active:bg-blue-200"
                onClick={reset}
            >
                RESET ALL TESTS
            </button>
        </div>
    );
};
