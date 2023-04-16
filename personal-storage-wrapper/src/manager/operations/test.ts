import { noop } from "../../utilities/data";
import { Value } from "../types";
import { DefaultTarget } from "../utilities/defaults";
import { OperationRunConfig } from "./types";

export const getTestOperationConfig = <S = null, V extends Value = any>(
    config: Partial<Omit<OperationRunConfig<V, DefaultTarget, S>, "config">> & {
        config?: Partial<OperationRunConfig<V, DefaultTarget, S>["config"]>;
    }
): OperationRunConfig<V, DefaultTarget, S> => ({
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
