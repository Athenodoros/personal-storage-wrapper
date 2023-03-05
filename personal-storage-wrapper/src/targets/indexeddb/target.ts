import { ErrorResult, Result, Target, TargetValue, ValueResult } from "../types";
import { IndexedDBTargetSerialisationConfig, IndexedDBTargetType } from "./types";

interface StoredIDBFile {
    id: string;
    buffer: ArrayBuffer;
    timestamp: Date;
}

const DB_NAME = "personal-storage-wrapper";
const DB_VERSION = 1;
const TABLE_NAME = "stores";

export class IndexedDBTarget implements Target<IndexedDBTargetType, IndexedDBTargetSerialisationConfig> {
    type: IndexedDBTargetType = IndexedDBTargetType;
    private id: string;
    private db: IDBDatabase;

    private constructor(db: IDBDatabase, id: string | undefined) {
        this.db = db;

        // Quick and dirty random 6-digit alpha-numeric string
        this.id = id ?? Math.random().toString(36).toUpperCase().slice(2, 8);
    }

    // Async constructor
    static create = async (id?: string): Promise<IndexedDBTarget | null> => {
        const db = await new Promise<IDBDatabase | null>((resolve) => {
            if (!("indexedDB" in window)) return resolve(null);

            const request: IDBOpenDBRequest = window.indexedDB.open(DB_NAME, DB_VERSION);
            request.onerror = () => resolve(null);
            request.onsuccess = () => resolve(request.result);
            request.onupgradeneeded = () => {
                const db = request.result;
                db.createObjectStore(TABLE_NAME, { keyPath: "id" });
                resolve(db);
            };
        });

        return db && new IndexedDBTarget(db, id);
    };

    // Data Handlers
    write = (buffer: ArrayBuffer): Result<Date> =>
        new Promise((resolve) => {
            const timestamp = new Date();
            const request = this.db
                .transaction(["stores"], "readwrite")
                .objectStore("stores")
                .put({ id: this.id, buffer, timestamp } as StoredIDBFile);
            request.onsuccess = () => resolve(new ValueResult(timestamp));
            request.onerror = () => resolve(new ErrorResult());
        });

    read = (): Result<TargetValue> =>
        new Promise((resolve) => {
            const request = this.db.transaction(["stores"]).objectStore("stores").get(this.id);
            request.onsuccess = () => {
                const result: StoredIDBFile | undefined = request.result;
                resolve(new ValueResult(result ? { timestamp: result.timestamp, buffer: result.buffer } : null));
            };
            request.onerror = () => resolve(new ErrorResult());
        });

    timestamp = (): Result<Date | null> =>
        new Promise((resolve) => {
            const request = this.db.transaction(["stores"]).objectStore("stores").get(this.id);
            request.onsuccess = () => {
                const result: StoredIDBFile | undefined = request.result;
                resolve(new ValueResult(result?.timestamp ?? null));
            };
            request.onerror = () => resolve(new ErrorResult());
        });

    // Serialisation
    serialise = (): IndexedDBTargetSerialisationConfig => ({ id: this.id });
}
