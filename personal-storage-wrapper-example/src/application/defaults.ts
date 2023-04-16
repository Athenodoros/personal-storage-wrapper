import { IndexedDBTarget, MemoryTarget, Sync } from "personal-storage-wrapper";

export interface ToDoItem {
    id: number;
    text: string;
}

export const DEFAULT_TODO_ITEMS: ToDoItem[] = [
    { id: 0, text: "Add a to-do item" },
    { id: 1, text: "Open in new tab" },
    { id: 2, text: "Sync a new cloud source" },
    { id: 3, text: "Do the same on a new device" },
    { id: 4, text: "Try again offline" },
];

export const DEFAULT_SYNC_STATE: Promise<Sync[]> = IndexedDBTarget.create().then((idbTarget) => [
    {
        target: new MemoryTarget({ delay: 1000 }),
        compressed: true,
    },
    {
        target: idbTarget,
        compressed: true,
    },
]);
