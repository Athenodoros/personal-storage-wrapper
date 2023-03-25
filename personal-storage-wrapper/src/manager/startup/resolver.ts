import { ResultValueType } from "../../targets/result";
import {
    ConflictingSyncStartupBehaviour,
    MaybeValue,
    SyncFromTargets,
    SyncOperationLogger,
    Targets,
    Value,
} from "../types";
import { DefaultTargetsType } from "../utilities/defaults";

type InitialSyncProcessingResult<V extends Value> =
    | {
          type: "preserve";
          didUpdateSyncs: boolean;
      }
    | {
          type: "value";
          value: V;
          didUpdateSyncs: boolean;
      };

export const handleInitialSyncValuesAndGetResult = <V extends Value, T extends Targets = DefaultTargetsType>(
    value: V,
    results: {
        sync: SyncFromTargets<T>;
        result: ResultValueType<MaybeValue<V>>;
    }[],
    resolveConflictingSyncValuesOnStartup: ConflictingSyncStartupBehaviour<T, V>,
    logger: () => SyncOperationLogger<SyncFromTargets<T>>
): InitialSyncProcessingResult<V> => {
    // If conflict or out of date sync, update value using callback
    TODO;

    // If any missing, write back
    TODO;

    // Return result
    return;
};
