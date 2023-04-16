import { Result } from "./result";

export type TargetValue = { timestamp: Date; buffer: ArrayBuffer } | null;

export interface Target<Type extends string, SerialisationConfig> {
    type: Type;

    // Data handlers
    write: (buffer: ArrayBuffer) => Result<Date>;
    read: () => Result<TargetValue>;
    timestamp: () => Result<Date | null>;

    // Serialisation
    serialise: () => SerialisationConfig;

    // Error Handling
    online: () => boolean;
    equals: (other: Target<any, any>) => boolean;
}

export type Deserialiser<T extends Target<any, any>, Async extends boolean = boolean> = (
    config: ReturnType<T["serialise"]>
) => Async extends true ? Promise<T> : T;
