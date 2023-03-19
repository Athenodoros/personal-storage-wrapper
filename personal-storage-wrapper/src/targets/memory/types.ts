export const MemoryTargetType = "memory" as const;
export type MemoryTargetType = typeof MemoryTargetType;

export interface MemoryTargetSerialisationConfig {
    value?: { timestamp: Date; encoded: string } | null;
}
