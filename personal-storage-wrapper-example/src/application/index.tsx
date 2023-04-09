import { DropboxTarget, GDriveTarget, PersonalStorageManager } from "personal-storage-wrapper";
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
            defaultSyncStates: DEFAULT_SYNC_STATE,
        }).then((manager) => {
            (window as any).manager = manager;
            setManager(manager);
        });
    }, []);

    return (
        <div className="flex h-screen w-screen">
            <SyncDisplay
                syncs={syncs}
                remove={manager?.removeSync}
                dropbox={async () => {
                    const target = await DropboxTarget.setupInPopup(DROPBOX_CLIENT_ID, DROPBOX_REDIRECT_URI);
                    if (target) manager?.addSync({ target, compressed: true });
                }}
                gdrive={async () => {
                    const target = await GDriveTarget.setupInPopup(GDRIVE_CLIENT_ID, GDRIVE_REDIRECT_URI);
                    if (target) manager?.addSync({ target, compressed: true });
                }}
            />

            {manager ? (
                <ToDoDisplay
                    todos={todos}
                    add={(text) =>
                        manager.setValueAndAsyncPushToSyncs(todos.concat({ id: new Date().valueOf(), text }))
                    }
                    remove={(id) => manager.setValueAndAsyncPushToSyncs(todos.filter((todo) => id !== todo.id))}
                />
            ) : (
                <LoadingScreen />
            )}
        </div>
    );
}
