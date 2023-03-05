export const MemoryTargetType = "memory" as const;
export type MemoryTargetType = typeof MemoryTargetType;

interface MemoryTargetSerialisationConfigPreserved {
    type: "preserve";
    value: { timestamp: Date; contents: string } | null;
    delayIndex: number;
}

interface MemoryTargetSerialisationConfigPreservedTemporary {
    type: "reset";
}

export type MemoryTargetSerialisationConfig = {
    delaysInMillis: number[];
} & (MemoryTargetSerialisationConfigPreserved | MemoryTargetSerialisationConfigPreservedTemporary);
