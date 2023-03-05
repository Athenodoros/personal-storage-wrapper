import { decodeFromArrayBuffer, encodeToArrayBuffer } from "../../utilities/buffers/encoding";
import { Deserialiser, Result, SyncTarget, SyncTargetValue, ValueResult } from "../types";
import { MemoryTargetSerialisationConfig, MemoryTargetType } from "./types";

export class MemorySyncTarget implements SyncTarget<MemoryTargetType, MemoryTargetSerialisationConfig> {
    type = MemoryTargetType;

    private value: SyncTargetValue;
    private delaysInMillis: number[];
    private delayIndex: number;
    private preserveStateOnSave: boolean;

    constructor(
        delaysInMillis: number[] = [0],
        preserveStateOnSave: boolean = false,
        value: SyncTargetValue = null,
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

    // Data management
    read = (): Result<SyncTargetValue> => this.delayed(() => new ValueResult(this.value));
    timestamp = (): Result<Date | null> => this.delayed(() => new ValueResult(this.value?.timestamp ?? null));
    write = (contents: ArrayBuffer): Result<Date> =>
        this.delayed(() => {
            const timestamp = new Date();
            this.value = { timestamp, contents };
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
                      contents: decodeFromArrayBuffer(this.value.contents),
                  },
                  delayIndex: this.delayIndex,
              }
            : { delaysInMillis: this.delaysInMillis, type: "reset" as const };

    //
}

export const MemorySyncTargetDeserialiser: Deserialiser<MemoryTargetType, MemoryTargetSerialisationConfig> = (config) =>
    config.type === "preserve"
        ? new MemorySyncTarget(
              config.delaysInMillis,
              true,
              config.value && {
                  timestamp: config.value.timestamp,
                  contents: encodeToArrayBuffer(config.value.contents),
              },
              config.delayIndex
          )
        : new MemorySyncTarget(config.delaysInMillis, false);
