export const MemoryTargetType = "memory" as const;
export type MemoryTargetType = typeof MemoryTargetType;

interface MemoryTargetSerialisationConfigPreserved {
    type: "preserve";
    value: { timestamp: Date; encoded: string } | null;
    delayIndex: number;
}

interface MemoryTargetSerialisationConfigPreservedTemporary {
    type: "reset";
}

export type MemoryTargetSerialisationConfig = {
    delaysInMillis: number[];
    fails: boolean;
} & (MemoryTargetSerialisationConfigPreserved | MemoryTargetSerialisationConfigPreservedTemporary);
