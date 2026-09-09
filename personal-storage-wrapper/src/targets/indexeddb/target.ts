import { Result } from "../result";
import { Deserialiser, Target, TargetValue } from "../types";
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
    private db: IDBDatabase | null;

    private constructor(db: IDBDatabase | null, id: string | undefined) {
        this.db = db;

        // Quick and dirty random 6-digit alpha-numeric string
        this.id = id ?? Math.random().toString(36).toUpperCase().slice(2, 8);
    }

    // Async constructor
    static create = async (id?: string): Promise<IndexedDBTarget> => {
        const db = await new Promise<IDBDatabase | null>((resolve) => {
            if (!("indexedDB" in window)) return resolve(null);

            try {
                const request: IDBOpenDBRequest = window.indexedDB.open(DB_NAME, DB_VERSION);
                request.onerror = () => resolve(null);
                request.onsuccess = () => resolve(request.result);
                // `onsuccess` fires once the version change transaction this runs in has finished,
                // and only then can the database be read from - so this does not resolve itself
                request.onupgradeneeded = () => request.result.createObjectStore(TABLE_NAME, { keyPath: "id" });
            } catch {
                // Some private browsing modes define `indexedDB` but throw on any attempt to open it
                resolve(null);
            }
        });

        const target = new IndexedDBTarget(db, id);

        // An open connection blocks another tab from upgrading or deleting the database for as long
        // as it is held, so let go of it and answer OFFLINE from then on instead
        if (db !== null) db.onversionchange = () => target.close();

        return target;
    };

    /** Closes the connection, after which every operation returns OFFLINE */
    close = () => {
        this.db?.close();
        this.db = null;
    };

    // Data Handlers
    write = (buffer: ArrayBuffer): Result<Date> =>
        new Result((resolve) => {
            if (this.db === null) return resolve({ type: "error", error: "OFFLINE" });

            const timestamp = new Date();
            const file: StoredIDBFile = { id: this.id, buffer, timestamp };
            const request = this.db.transaction(["stores"], "readwrite").objectStore("stores").put(file);
            request.onsuccess = () => resolve({ type: "value", value: timestamp });
            request.onerror = () => resolve({ type: "error", error: "OFFLINE" });
        });

    read = (): Result<TargetValue> =>
        new Result((resolve) => {
            if (this.db === null) return resolve({ type: "error", error: "OFFLINE" });

            const request = this.db.transaction(["stores"]).objectStore("stores").get(this.id);
            request.onsuccess = () => {
                const result: StoredIDBFile | undefined = request.result;
                resolve({
                    type: "value",
                    value: result ? { timestamp: result.timestamp, buffer: result.buffer } : null,
                });
            };
            request.onerror = () => resolve({ type: "error", error: "OFFLINE" });
        });

    timestamp = (): Result<Date | null> => this.read().map((value) => value?.timestamp ?? null);

    // Serialisation
    static deserialise: Deserialiser<IndexedDBTarget, true> = ({ id }) => IndexedDBTarget.create(id);

    serialise = (): IndexedDBTargetSerialisationConfig => ({ id: this.id });

    // Error Handling
    online = () => true;
    equals = (other: Target<any, any>): boolean => other instanceof IndexedDBTarget && other.id === this.id;
}
