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
}

export type Deserialiser<Type extends string, Config> = (config: Config) => Promise<Target<Type, Config>>;
