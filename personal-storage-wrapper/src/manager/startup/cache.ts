import { Target } from "../../targets";
import { deepEquals, identity, orderByAsc } from "../../utilities/data";
import { ListBuffer } from "../../utilities/listbuffer";
import { PersonalStorageManager } from "../manager";
import {
    ConflictingSyncStartupBehaviour,
    Deserialisers,
    InitialValue,
    PSMConfig,
    PSMCreationConfig,
    Value,
} from "../types";
import { DefaultDeserialisers } from "../utilities/defaults";
import { createPSM } from "./constructor";
import { StartValue } from "./types";

const anyCache: Record<
    string,
    {
        manager: Promise<PersonalStorageManager<any>>;
        types: string[];
        config: Partial<PSMCreationConfig<any, any>>;
    }
> = {};

export function createPSMWithCache<V extends Value, T extends Target<any, any>>(
    createPSMObject: (
        id: string,
        start: StartValue<V, T>,
        deserialisers: Deserialisers<T>,
        recents: ListBuffer<V>,
        config: PSMConfig<V, T>,
        resolveConflictingSyncValuesOnStartup: ConflictingSyncStartupBehaviour<V, T> | undefined
    ) => PersonalStorageManager<V, T>,
    defaultInitialValue: InitialValue<V>,
    config: Partial<PSMCreationConfig<V, T>> = {},
    maybeDeserialisers?: Deserialisers<T>
): Promise<PersonalStorageManager<V, T>> {
    const typedCache = anyCache as any as Record<
        string,
        {
            manager: Promise<PersonalStorageManager<V, T>>;
            types: string[];
            config: Partial<PSMCreationConfig<V, T>>;
        }
    >;

    const id = config.id ?? "psm-default-cache-id";
    const types = orderByAsc(Object.keys(maybeDeserialisers ?? DefaultDeserialisers), identity);

    if (typedCache[id]) {
        const value = typedCache[id];
        if (!deepEquals(value.types, types))
            throw new Error("Inconsistent deserialisers between cached PSM creations!");

        typedCache[id].config = config;

        // This is kept in case the manager has already been created when createPSMWithCache is called
        typedCache[id].manager = value.manager.then((manager) => {
            if (config.pollPeriodInSeconds !== undefined)
                manager.config.pollPeriodInSeconds = config.pollPeriodInSeconds;
            if (config.onValueUpdate !== undefined) manager.config.onValueUpdate = config.onValueUpdate;
            if (config.handleSyncOperationLog !== undefined)
                manager.config.handleSyncOperationLog = config.handleSyncOperationLog;
            if (config.saveSyncData !== undefined) manager.config.saveSyncData = config.saveSyncData;
            if (config.onSyncStatesUpdate !== undefined) manager.config.onSyncStatesUpdate = config.onSyncStatesUpdate;
            if (config.resolveConflictingSyncsUpdate !== undefined)
                manager.config.resolveConflictingSyncsUpdate = config.resolveConflictingSyncsUpdate;

            return manager;
        });
    } else {
        typedCache[id] = {
            types,
            manager: createPSM<V, T>(
                createPSMObject,
                defaultInitialValue,
                config,
                () => typedCache[id].config,
                maybeDeserialisers
            ),
            config,
        };
    }

    return typedCache[id].manager;
}
