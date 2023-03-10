export const IndexedDBTargetType = "indexedb" as const;
export type IndexedDBTargetType = typeof IndexedDBTargetType;

export interface IndexedDBTargetSerialisationConfig {
    id: string;
}
