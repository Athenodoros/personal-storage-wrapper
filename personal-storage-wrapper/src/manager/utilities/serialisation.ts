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

            // `missedWrite` is kept, so that a later startup knows the target fell behind.
            // `unreadable` is never saved, but an older version of this library may have saved it, and
            // `desynced`, which older versions also saved, is what `missedWrite` replaced. It was
            // cleared by any poll that reached the target, so it can't be relied on to mean the same.
            // `lastSeenWriteTime` is what older versions saved `lastProcessedWriteTime` as.
            const {
                desynced: _replacedByMissedWrite,
                unreadable: _heldUnreadableValue,
                lastSeenWriteTime: savedUnderEarlierName,
                ...saved
            } = JSON.parse(config);
            const sync = { ...saved, lastProcessedWriteTime: saved.lastProcessedWriteTime ?? savedUnderEarlierName };
            return {
                ...sync,
                // JSON has no dates, so this comes back as the string it was written as
                lastProcessedWriteTime:
                    sync.lastProcessedWriteTime === undefined || sync.lastProcessedWriteTime === null
                        ? undefined
                        : new Date(sync.lastProcessedWriteTime),
                target: await deserialisers[type](sync.target),
            };
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
            // Whether a target's value can be read is found again on each startup, rather than remembered
            config: JSON.stringify({ ...sync, unreadable: undefined, target: sync.target.serialise() }),
        };
    });
    return JSON.stringify(config);
};
