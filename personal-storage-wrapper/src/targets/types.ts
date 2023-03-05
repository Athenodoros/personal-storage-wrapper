/**
 * Operation Results
 */
export type Result<Value> = Promise<
    {
        map: <T>(fn: (value: Value) => T) => Result<T>;
        flatmap: <T>(fn: (value: Value) => Result<T>) => Result<T>;
    } & ({ readonly type: "value"; readonly value: Value } | { readonly type: "error"; readonly value: null })
>;

export class ValueResult<Value> {
    readonly type: "value" = "value";
    readonly value: Value;

    static promise = <Value>(value: Value) => Promise.resolve(new ValueResult(value));
    constructor(value: Value) {
        this.value = value;
    }

    map = <T>(fn: (value: Value) => T) => ValueResult.promise(fn(this.value as Value));
    flatmap = <T>(fn: (value: Value) => Result<T>) => fn(this.value as Value);
}
export class ErrorResult<Value> {
    readonly type: "error" = "error";
    readonly value: null = null;

    static promise = <Value>() => Promise.resolve(new ErrorResult<Value>());
    constructor() {}

    map = <T>(_: (value: Value) => T) => ErrorResult.promise<T>();
    flatmap = <T>(_: (value: Value) => Result<T>) => ErrorResult.promise<T>();
}

/**
 * Sync target descriptions
 */
export type SyncTargetValue = { timestamp: Date; contents: ArrayBuffer } | null;

export interface SyncTarget<Type extends string, SerialisationConfig> {
    type: Type;

    write: (value: ArrayBuffer) => Result<Date>;
    read: () => Result<SyncTargetValue>;
    timestamp: () => Result<Date | null>;

    serialise: () => SerialisationConfig;
}

export type Deserialiser<Type extends string, Config> = (config: Config) => SyncTarget<Type, Config>;
