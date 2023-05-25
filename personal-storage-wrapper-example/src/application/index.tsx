import {
    DropboxTarget,
    GDriveTarget,
    IndexedDBTarget,
    MemoryTarget,
    PersonalStorageManager,
} from "personal-storage-wrapper";
import { useEffect, useState } from "react";
import { LoadingScreen } from "./LoadingScreen";
import { SyncDisplay } from "./SyncDisplay";
import { ToDoDisplay } from "./ToDoDisplay";
import { DROPBOX_CLIENT_ID, DROPBOX_REDIRECT_URI, GDRIVE_CLIENT_ID, GDRIVE_REDIRECT_URI } from "./constants";
import { DEFAULT_SYNC_STATE, DEFAULT_TODO_ITEMS, ToDoItem } from "./defaults";
import { SyncWithState, trackSyncState } from "./tracking";

export function App() {
    const [manager, setManager] = useState<PersonalStorageManager<ToDoItem[]> | null>(null);
    const [syncs, setSyncs] = useState<SyncWithState[]>([]);
    const [todos, setToDos] = useState<ToDoItem[]>([]);

    useEffect(() => {
        PersonalStorageManager.createWithCache(DEFAULT_TODO_ITEMS, {
            ...trackSyncState(setSyncs),
            onValueUpdate: setToDos,
            getDefaultSyncs: () => DEFAULT_SYNC_STATE,
        }).then((manager) => {
            (window as any).manager = manager;
            setManager(manager);
        });
    }, []);

    return (
        <div className="flex flex-col sm:flex-row h-screen w-screen">
            <SyncDisplay
                syncs={syncs}
                remove={manager?.removeSync}
                memory={() => manager?.addTarget(new MemoryTarget({ delay: 1000 }))}
                indexeddb={async () => manager?.addTarget(await IndexedDBTarget.create())}
                dropbox={async () => {
                    const target = await DropboxTarget.setupInPopup(DROPBOX_CLIENT_ID, DROPBOX_REDIRECT_URI);
                    if (target) manager?.addTarget(target);
                }}
                gdrive={async () => {
                    const target = await GDriveTarget.setupInPopup(GDRIVE_CLIENT_ID, GDRIVE_REDIRECT_URI);
                    if (target) manager?.addTarget(target);
                }}
            />

            {manager ? (
                <ToDoDisplay
                    todos={todos}
                    add={(text) => manager.setValue(todos.concat({ id: new Date().valueOf(), text }))}
                    remove={(id) => manager.setValue(todos.filter((todo) => id !== todo.id))}
                />
            ) : (
                <LoadingScreen />
            )}
        </div>
    );
}
