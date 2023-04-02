import { noop } from "../../utilities/data";
import { Targets, Value } from "../types";
import { OperationRunConfig } from "./types";

export const getTestOperationConfig = <S, V extends Value, T extends Targets>(
    config: Partial<Omit<OperationRunConfig<V, T, S>, "config">> & {
        config?: Partial<OperationRunConfig<V, T, S>["config"]>;
    }
): OperationRunConfig<V, T, S> => ({
    args: [],
    logger: () => noop,
    value: "DEFAULT" as unknown as V,
    recents: [],
    syncs: [],
    ...config,
    config: {
        pollPeriodInSeconds: null,
        onValueUpdate: noop,
        handleSyncOperationLog: noop,
        saveSyncData: noop,
        onSyncStatesUpdate: noop,
        resolveConflictingSyncsUpdate: async (value) => value,
        ...(config.config ?? {}),
    },
});
