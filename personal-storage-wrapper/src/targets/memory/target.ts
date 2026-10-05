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
        if (this.fails) return Result.error<T>("OFFLINE");
        return new Result<T>((resolve) => setTimeout(() => resolve({ type: "value", value: thunk() }), this.delay));
    };

    // Data handlers
    read = (): Result<TargetValue> => this.delayed(() => this.value);
    timestamp = (): Result<Date | null> => this.delayed(() => this.value?.timestamp ?? null);
    write = (buffer: ArrayBuffer, expectedValueTimestamp?: Date | null): Result<Date> =>
        this.delayed(() => {
            // Compared when the write lands, as a target that checks and writes in one step would
            const held = this.value?.timestamp.valueOf() ?? null;
            if (expectedValueTimestamp !== undefined && held !== (expectedValueTimestamp?.valueOf() ?? null))
                return null;

            // Each write is stamped later than the last. The manager tells that something else has written
            // to a target by its timestamp changing, so two writes in the same millisecond would look like one.
            const timestamp = new Date(Math.max(Date.now(), (this.value?.timestamp.valueOf() ?? 0) + 1));
            this.value = { timestamp, buffer };
            return timestamp;
        }).flatmap((timestamp) =>
            timestamp === null
                ? Result.error<Date>("CONFLICT", "The target no longer holds the value the write expected")
                : Result.value(timestamp)
        );

    // Serialisation
    static deserialise: Deserialiser<MemoryTarget, false> = (config) =>
        new MemoryTarget({
            delay: config.delay,
            fails: config.fails,
            preserveValueOnSave: config.preserveValueOnSave,
            value: config.value && {
                timestamp: new Date(config.value.timestamp),
                buffer: encodeToArrayBuffer(config.value.encoded),
            },
        });

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
