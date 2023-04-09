import { DropboxTarget, GDriveTarget, MemoryTarget } from "personal-storage-wrapper";
import { SyncState, SyncWithState } from "./tracking";

export const SyncDisplay: React.FC<{
    syncs: SyncWithState[];
    remove?: (sync: SyncWithState) => void;
    memory: () => void;
    indexeddb: () => void;
    dropbox: () => void;
    gdrive: () => void;
}> = ({ syncs, remove, memory, indexeddb, dropbox, gdrive }) => {
    const hasMemorySync = syncs.some((sync) => sync.target.type === "memory");
    const hasIDBSync = syncs.some((sync) => sync.target.type === "indexeddb");

    return (
        <div className="bg-violet-50 w-96 flex flex-col items-center">
            <h2 className="text-xl text-violet-500 mt-6 mb-4 font-semibold">Synced To-Do App</h2>
            <div className="self-stretch px-4 grow">
                {syncs.map((sync, idx) => (
                    <SourceTableEntry key={idx} sync={sync} remove={remove} />
                ))}
                {!hasMemorySync || !hasIDBSync ? (
                    <div className="text-center text-sm text-slate-400 italic font-light mt-3">
                        Recreate{" "}
                        {hasMemorySync ? undefined : (
                            <a
                                href="#"
                                className="text-violet-500 font-normal underline before:content-['↗_']"
                                onClick={memory}
                            >
                                Memory Sync
                            </a>
                        )}
                        {!hasMemorySync && !hasIDBSync ? " or " : undefined}
                        {hasIDBSync ? undefined : (
                            <a
                                href="#"
                                className="text-violet-500 font-normal underline before:content-['↗_']"
                                onClick={indexeddb}
                            >
                                IndexedDB Sync
                            </a>
                        )}
                    </div>
                ) : undefined}
            </div>
            <div className="w-64 text-center text-sm text-slate-400 italic font-light">
                <p className="mb-4">
                    This is an example application built on the{" "}
                    <a href="#" className="text-violet-500 font-normal underline">
                        personal-storage-wrapper
                    </a>{" "}
                    library.
                </p>
                <p className="mb-8">
                    Try making some To-Dos and opening the app in another tab, or setting up either{" "}
                    <a
                        href="#"
                        className="text-violet-500 font-normal underline before:content-['↗_']"
                        onClick={dropbox}
                    >
                        Dropbox
                    </a>{" "}
                    or{" "}
                    <a
                        href="#"
                        className="text-violet-500 font-normal underline before:content-['↗_']"
                        onClick={gdrive}
                    >
                        Google Drive
                    </a>{" "}
                    and opening in another browser!
                </p>
            </div>
        </div>
    );
};

const IconsDisplays = {
    SYNCED: { className: "bg-green-600", icon: "cloud_done" },
    DOWNLOAD: { className: "bg-blue-600", icon: "cloud_download" },
    UPLOAD: { className: "bg-blue-600", icon: "cloud_upload" },
    POLL: { className: "bg-blue-600", icon: "cloud_sync" },
    OFFLINE: { className: "bg-gray-500", icon: "cloud_offline" },
    ERROR: { className: "bg-red-600", icon: "cloud_offline" },
};

const getIconDisplay = (state: SyncState) =>
    state.connection === "CONNECTED" ? IconsDisplays[state.operation ?? "SYNCED"] : IconsDisplays[state.connection];

const SourceTableEntry: React.FC<{
    sync: SyncWithState;
    remove?: (sync: SyncWithState) => void;
}> = ({ sync, remove }) => {
    return (
        <div className="bg-white rounded-xl border-slate-200 border p-2 flex items-center mb-2">
            <img
                className="h-7 ml-2 mr-3"
                src={
                    sync.target.type === "dropbox"
                        ? "dropbox.png"
                        : sync.target.type === "gdrive"
                        ? "gdrive.png"
                        : "html5.png"
                }
            />
            <div className="flex-1 min-w-0 mr-4">
                <p className="truncate font-bold text-base text-slate-800">
                    {sync.target.type === "dropbox"
                        ? (sync.target as DropboxTarget).user.name
                        : sync.target.type === "gdrive"
                        ? (sync.target as GDriveTarget).user.name
                        : "Browser Storage"}
                </p>
                <p className="truncate text-slate-400 text-xs">
                    {sync.target.type === "dropbox"
                        ? (sync.target as DropboxTarget).user.email
                        : sync.target.type === "gdrive"
                        ? (sync.target as GDriveTarget).user.email
                        : sync.target.type === "indexeddb"
                        ? "IndexedDB"
                        : (sync.target as MemoryTarget).delay
                        ? `Memory Store [${(sync.target as MemoryTarget).delay}ms Delay]`
                        : "Memory Store"}
                </p>
            </div>
            <div className="flex">
                <span
                    className={
                        "material-icons-two-tone w-[20px] text-xl mr-4 text-transparent bg-clip-text " +
                        getIconDisplay(sync.state).className
                    }
                >
                    {getIconDisplay(sync.state).icon}
                </span>
            </div>
            <button
                className="text-slate-500 rounded-lg p-1 flex hover:text-slate-800 hover:bg-slate-100 transition"
                onClick={() => remove && remove(sync)}
            >
                <span className="material-icons">close</span>
            </button>
        </div>
    );
};
