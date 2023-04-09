import { decodeFromArrayBuffer, encodeToArrayBuffer } from "../../utilities/buffers/encoding";
import { Result } from "../result";
import { Deserialiser, Target, TargetValue } from "../types";
import { MemoryTargetSerialisationConfig, MemoryTargetType } from "./types";

export class MemoryTarget implements Target<MemoryTargetType, MemoryTargetSerialisationConfig> {
    type = MemoryTargetType;

    public value: TargetValue;
    public delay: number;
    public fails: boolean;
    public preserveValueOnSave: boolean;

    constructor(
        config?: Partial<{
            value: TargetValue;
            delay: number;
            fails: boolean;
            preserveValueOnSave: boolean;
        }>
    ) {
        const { value = null, delay = 0, fails = false, preserveValueOnSave = false } = config ?? {};

        this.value = value;
        this.delay = delay;
        this.fails = fails;
        this.preserveValueOnSave = preserveValueOnSave;
    }

    // Delay simulation
    private delayed = <T>(thunk: () => T) => {
        if (this.fails) return Result.error<T>();
        return new Result<T>((resolve) => setTimeout(() => resolve({ type: "value", value: thunk() }), this.delay));
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
            new MemoryTarget({
                delay: config.delay,
                fails: config.fails,
                preserveValueOnSave: config.preserveValueOnSave,
                value: config.value && {
                    timestamp: new Date(config.value.timestamp),
                    buffer: encodeToArrayBuffer(config.value.encoded),
                },
            })
        );

    serialise = () => ({
        preserveValueOnSave: this.preserveValueOnSave,
        delay: this.delay,
        fails: this.fails,
        value:
            this.preserveValueOnSave && this.value
                ? {
                      timestamp: this.value.timestamp.valueOf(),
                      encoded: decodeFromArrayBuffer(this.value.buffer),
                  }
                : null,
    });

    // Error Handling
    online = () => !this.fails;
    equals = (other: Target<any, any>): boolean => this === other;
}
