import { Target } from "../../targets";
import { Value } from "../types";
import { AdditionOperationRunner } from "./addition";
import { PollOperationRunner } from "./poll";
import { RemovalOperationRunner } from "./removal";
import { OperationRunConfig, OperationRunner } from "./types";
import { UpdateOperationRunner } from "./update";
import { WriteOperationRunner } from "./write";

export const OperationRunners = {
    addition: AdditionOperationRunner,
    poll: PollOperationRunner,
    removal: RemovalOperationRunner,
    update: UpdateOperationRunner,
    write: WriteOperationRunner,
} satisfies Record<string, OperationRunner<any>>;
// export const Operations = Object.keys(OperationRunners) as Operation[];

export type Operation = keyof typeof OperationRunners;
export type OperationArgument<O extends Operation> = Parameters<
    typeof OperationRunners[O]
>[0] extends OperationRunConfig<Value, Target<any, any>, infer S>
    ? S
    : never;
export type OperationState = {
    [Key in Operation]: { argument: OperationArgument<Key>; callback: () => void }[];
} & { running?: Operation | "startup" }; // values rather than boolean for debugging
