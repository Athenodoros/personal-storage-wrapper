import { Deserialisers, SyncFromTargets, Targets, Value } from "../../manager/types";
import { compress, decompress } from "../../utilities/buffers/compression";
import { decodeFromArrayBuffer, encodeToArrayBuffer } from "../../utilities/buffers/encoding";

/**
 * Value Serialisation
 */
export const getValueFromBuffer = async <V extends Value>(buffer: ArrayBuffer, compressed: boolean) =>
    JSON.parse(await (compressed ? decompress : decodeFromArrayBuffer)(buffer)) as V;

export const getBufferFromValue = async <V extends Value>(value: V, compressed: boolean) =>
    (compressed ? compress : encodeToArrayBuffer)(JSON.stringify(value));

/**
 * Sync Serialisation
 */

interface SyncSerialisedConfig<T extends Targets> {
    type: keyof T;
    config: string;
}

export const getSyncsFromConfig = async <T extends Targets>(
    syncsConfigString: string,
    deserialisers: Deserialisers<T>
): Promise<SyncFromTargets<T>[]> => {
    const configs = JSON.parse(syncsConfigString) as SyncSerialisedConfig<T>[];

    let syncs = await Promise.all(
        configs.map(async ({ config, type }) => {
            if (deserialisers[type] === undefined) return null;

            const sync = JSON.parse(config);
            return { ...sync, target: await deserialisers[type](sync.target) };
        })
    );

    if (syncs.some((sync) => sync === undefined)) {
        console.error(
            "Missing deserialiser type: " + String(configs.find(({ type }) => deserialisers[type] === undefined)?.type)
        );
        syncs = syncs.filter((sync) => sync !== undefined);
    }

    return syncs as unknown[] as SyncFromTargets<T>[];
};

export const getConfigFromSyncs = <T extends Targets>(syncs: SyncFromTargets<T>[]): string => {
    const config: SyncSerialisedConfig<T>[] = syncs.map((sync) => {
        return {
            type: sync.target.type,
            config: JSON.stringify({ ...sync, target: sync.target.serialise() }),
        };
    });
    return JSON.stringify(config);
};
