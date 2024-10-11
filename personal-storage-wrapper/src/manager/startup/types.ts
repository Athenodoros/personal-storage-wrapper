import { Target } from "../../targets";
import { Result, ResultValueType } from "../../targets/result";
import { MaybeValue, Sync, Value } from "../types";

export interface PSMFinalValue<V extends Value, T extends Target<any, any>> {
    type: "final";
    results: { sync: Sync<T>; value: ResultValueType<MaybeValue<V>> }[];
    value: V;
}

export interface PSMProvisionalValue<V extends Value, T extends Target<any, any>> {
    type: "provisional";
    values: { sync: Sync<T>; value: Result<MaybeValue<V>> }[];
    value: V;
}

export type StartValue<V extends Value, T extends Target<any, any>> = PSMFinalValue<V, T> | PSMProvisionalValue<V, T>;
