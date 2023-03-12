export type Value = object | number | string | object[] | number[] | string[];
export type InitialValue<V extends Value> = V | (() => V) | (() => Promise<V>);
export type Targets = { [id: string]: Value };
