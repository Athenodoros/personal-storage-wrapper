export const MemoryTargetType = "memory" as const;
export type MemoryTargetType = typeof MemoryTargetType;

export interface MemoryTargetSerialisationConfig {
    value?: { timestamp: number; encoded: string } | null;
}
