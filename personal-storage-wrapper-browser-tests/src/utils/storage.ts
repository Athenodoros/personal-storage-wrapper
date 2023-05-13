const LOCAL_STORAGE_PREFIX = "PSW-BROWSER-TESTS-";

export const getStorageManager = <T>(key: string) => ({
    clear: () => localStorage.removeItem(LOCAL_STORAGE_PREFIX + key),
    save: (value: T) => localStorage.setItem(LOCAL_STORAGE_PREFIX + key, JSON.stringify(value)),
    load: () => {
        const stored = localStorage.getItem(LOCAL_STORAGE_PREFIX + key);
        return stored ? (JSON.parse(stored) as T) : undefined;
    },
});
