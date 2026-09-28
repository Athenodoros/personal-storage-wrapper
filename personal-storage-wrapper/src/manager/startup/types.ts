import { Target } from "../../targets";
import { Result, ResultValueType } from "../../targets/result";
import { MaybeValue, StartSource, Sync, Value } from "../types";

export interface PSMFinalValue<V extends Value, T extends Target<any, any>> {
    type: "final";
    results: { sync: Sync<T>; value: ResultValueType<MaybeValue<V>> }[];
    value: V;
    source: Exclude<StartSource, "TARGET">;
}

export interface PSMProvisionalValue<V extends Value, T extends Target<any, any>> {
    type: "provisional";
    values: { sync: Sync<T>; value: Result<MaybeValue<V>> }[];
    value: V;
    /** When the value was written to the target it was read from */
    timestamp: Date;
}

export type StartValue<V extends Value, T extends Target<any, any>> = PSMFinalValue<V, T> | PSMProvisionalValue<V, T>;
