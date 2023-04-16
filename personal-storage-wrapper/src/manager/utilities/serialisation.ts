import { Deserialisers, Sync, Value } from "../../manager/types";
import { Target } from "../../targets";
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

interface SyncSerialisedConfig<T extends Target<any, any>> {
    type: keyof T;
    config: string;
}

export const getSyncsFromConfig = async <T extends Target<any, any>>(
    syncsConfigString: string,
    deserialisers: Deserialisers<T>
): Promise<Sync<T>[]> => {
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

    return syncs as unknown[] as Sync<T>[];
};

export const getConfigFromSyncs = <T extends Target<any, any>>(syncs: Sync<T>[]): string => {
    const config: SyncSerialisedConfig<T>[] = syncs.map((sync) => {
        return {
            type: sync.target.type,
            config: JSON.stringify({ ...sync, target: sync.target.serialise() }),
        };
    });
    return JSON.stringify(config);
};
