import { decodeFromArrayBuffer, encodeToArrayBuffer } from "../../utilities/buffers/encoding";
import { Result } from "../result";
import { Deserialiser, Target, TargetValue } from "../types";
import { MemoryTargetSerialisationConfig, MemoryTargetType } from "./types";

export class MemoryTarget implements Target<MemoryTargetType, MemoryTargetSerialisationConfig> {
    type = MemoryTargetType;

    private value: TargetValue;
    private delaysInMillis: number[];
    private fails: boolean;
    private delayIndex: number;
    private preserveStateOnSave: boolean;

    constructor(
        delaysInMillis: number[] = [0],
        preserveStateOnSave: boolean = false,
        fails: boolean = false,
        value: TargetValue = null,
        delayIndex: number = 0
    ) {
        this.value = value;
        this.delayIndex = delayIndex % delaysInMillis.length;
        this.fails = fails;
        this.delaysInMillis = delaysInMillis;
        this.preserveStateOnSave = preserveStateOnSave;
    }

    // Delay simulation
    private delayed = <T>(thunk: () => T) => {
        if (this.fails) return Result.error<T>();

        const delay = this.delaysInMillis[this.delayIndex];
        this.delayIndex = (this.delayIndex + 1) % this.delaysInMillis.length;
        return new Result<T>((resolve) => setTimeout(() => resolve({ type: "value", value: thunk() }), delay));
    };

    // Data handlers
    read = (): Result<TargetValue> => this.delayed(() => this.value);
    timestamp = (): Result<Date | null> => this.delayed(() => this.value?.timestamp ?? null);
    write = (buffer: ArrayBuffer): Result<Date> =>
        this.delayed(() => {
            const timestamp = new Date();
            this.value = { timestamp, buffer };
            return timestamp;
        });

    // Serialisation
    static deserialise: Deserialiser<MemoryTargetType, MemoryTargetSerialisationConfig> = (config) =>
        Promise.resolve(
            config.type === "preserve"
                ? new MemoryTarget(
                      config.delaysInMillis,
                      true,
                      config.fails,
                      config.value && {
                          timestamp: config.value.timestamp,
                          buffer: encodeToArrayBuffer(config.value.encoded),
                      },
                      config.delayIndex
                  )
                : new MemoryTarget(config.delaysInMillis, false, config.fails)
        );

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
                  fails: this.fails,
              }
            : { delaysInMillis: this.delaysInMillis, type: "reset" as const, fails: this.fails };
}
