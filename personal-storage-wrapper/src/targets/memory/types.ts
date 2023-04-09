export const MemoryTargetType = "memory" as const;
export type MemoryTargetType = typeof MemoryTargetType;

export interface MemoryTargetSerialisationConfig {
    preserveValueOnSave: boolean;
    value: { timestamp: number; encoded: string } | null;
    delay: number;
    fails: boolean;
}
