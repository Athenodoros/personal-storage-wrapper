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

            const {
                lastSeenWriteTime: savedUnderEarlierName,
                lastProcessedWriteTime = savedUnderEarlierName,
                desynced: _replacedByMissedWrite,
                unreadable: _foundAgainOnStartup,
                missedWrite,
                target,
                ...saved
            } = JSON.parse(config) as LegacySyncSerialisationFormat<T>;

            return {
                ...saved,
                status: missedWrite ? { type: "BEHIND", cause: "INHERITED" } : { type: "IN_STEP" },
                lastProcessedWriteTime:
                    lastProcessedWriteTime === undefined || lastProcessedWriteTime === null
                        ? undefined
                        : new Date(lastProcessedWriteTime),
                target: await deserialisers[type](target),
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

export const getConfigFromSyncs = <T extends Target<any, any>>(syncs: readonly Sync<T>[]): string => {
    const config: SyncSerialisedConfig<T>[] = syncs.map((sync) => {
        const saved: SyncSerialisationFormat<T> = {
            target: sync.target.serialise(),
            compressed: sync.compressed,
            missedWrite: sync.status.type !== "IN_STEP",
            lastProcessedWriteTime: sync.lastProcessedWriteTime,
        };
        return { type: sync.target.type, config: JSON.stringify(saved) };
    });
    return JSON.stringify(config);
};

/**
 * A sync as it is saved, and sent to other contexts. Of its status, only whether it is behind: why, and
 * whether its value can be read, each context finds out for itself, as it does what its target holds.
 */
type SyncSerialisationFormat<T extends Target<any, any>> = Omit<
    Sync<T>,
    "target" | "status" | "lastSeenValueTimestamp"
> & {
    target: ReturnType<T["serialise"]>;
    missedWrite: boolean;
};

/**
 * A sync as it may be read back: saved by this version, whose dates come back as strings, or an older
 * one. Older versions left `missedWrite` out where it was false, saved `lastProcessedWriteTime` as
 * `lastSeenWriteTime`, and `desynced`, which `missedWrite` replaced but which can't be read as one, and
 * they may have saved `unreadable`.
 */
type LegacySyncSerialisationFormat<T extends Target<any, any>> = Omit<
    SyncSerialisationFormat<T>,
    "lastProcessedWriteTime" | "missedWrite"
> & {
    missedWrite?: boolean;
    lastProcessedWriteTime?: string | null;
    lastSeenWriteTime?: string | null;
    desynced?: boolean;
    unreadable?: boolean;
};
