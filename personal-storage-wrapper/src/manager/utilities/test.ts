import { DropboxTarget } from "../../targets";
import { MemoryTarget, MemoryTargetType } from "../../targets/memory";
import { MemoryTargetSerialisationConfig } from "../../targets/memory/types";
import { Sync, Value } from "../types";
import { getBufferFromValue } from "../utilities/serialisation";

export const delay = (duration: number) => new Promise((resolve) => setTimeout(() => resolve(null), duration));

type TestSyncConfig<V> = Partial<{
    value: V;
    delay: number;
    fails: boolean;
    preserveValueOnSave: boolean;
    compressed: boolean;
    timestamp: number | Date;
}>;

export const getTestSync = async <V extends Value>(config: TestSyncConfig<V> = {}) =>
    (await getTestSyncAndValue(config)).sync;

const getTestSyncAndValue = async <V extends Value>({
    value: raw,
    compressed = false,
    timestamp,
    ...config
}: TestSyncConfig<V> = {}) => {
    const value = raw && {
        timestamp: timestamp === undefined ? new Date() : new Date(timestamp),
        buffer: await getBufferFromValue(raw, compressed),
    };
    const target = new MemoryTarget({ value, ...config });
    const sync: Sync<MemoryTargetType, MemoryTargetSerialisationConfig> = { target, compressed };

    return { sync, value };
};

export const getTestDropBoxSync = async ({ compressed = false }: { compressed?: boolean } = {}) => ({
    target: await DropboxTarget.deserialise({
        connection: { clientId: "", refreshToken: "", accessToken: "", expiry: new Date() },
        user: { id: "", email: "", name: "" },
        path: "/data.bak",
    }),
    compressed,
});
