export const IndexedDBTargetType = "memory" as const;
export type IndexedDBTargetType = typeof IndexedDBTargetType;

export interface IndexedDBTargetSerialisationConfig {
    id: string;
}
