export const IndexedDBTargetType = "indexeddb" as const;
export type IndexedDBTargetType = typeof IndexedDBTargetType;

export interface IndexedDBTargetSerialisationConfig {
    id: string;
}
