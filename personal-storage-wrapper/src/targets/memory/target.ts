import { decodeFromArrayBuffer } from "../../utilities/buffers/encoding";
import { Result, Target, TargetValue, ValueResult } from "../types";
import { MemoryTargetSerialisationConfig, MemoryTargetType } from "./types";

export class MemoryTarget implements Target<MemoryTargetType, MemoryTargetSerialisationConfig> {
    type = MemoryTargetType;

    private value: TargetValue;
    private delaysInMillis: number[];
    private delayIndex: number;
    private preserveStateOnSave: boolean;

    constructor(
        delaysInMillis: number[] = [0],
        preserveStateOnSave: boolean = false,
        value: TargetValue = null,
        delayIndex: number = 0
    ) {
        this.value = value;
        this.delayIndex = delayIndex % delaysInMillis.length;
        this.delaysInMillis = delaysInMillis;
        this.preserveStateOnSave = preserveStateOnSave;
    }

    // Delay simulation
    private delayed = <T>(thunk: () => T) => {
        const delay = this.delaysInMillis[this.delayIndex];
        this.delayIndex = (this.delayIndex + 1) % this.delaysInMillis.length;
        return new Promise<T>((resolve) => setTimeout(() => resolve(thunk()), delay));
    };

    // Data handlers
    read = (): Result<TargetValue> => this.delayed(() => new ValueResult(this.value));
    timestamp = (): Result<Date | null> => this.delayed(() => new ValueResult(this.value?.timestamp ?? null));
    write = (buffer: ArrayBuffer): Result<Date> =>
        this.delayed(() => {
            const timestamp = new Date();
            this.value = { timestamp, buffer };
            return new ValueResult(timestamp);
        });

    // Serialisation
    serialise = () =>
        this.preserveStateOnSave
            ? {
                  delaysInMillis: this.delaysInMillis,
                  type: "preserve" as const,
                  value: this.value && {
                      timestamp: this.value.timestamp,
                      encoded: decodeFromArrayBuffer(this.value.buffer),
                  },
                  delayIndex: this.delayIndex,
              }
            : { delaysInMillis: this.delaysInMillis, type: "reset" as const };
}
