import { DropboxTarget } from "../../targets";
import { MemoryTarget } from "../../targets/memory";
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
    const target = new MemoryTarget({ value, preserveValueOnSave: true, ...config });
    const sync: Sync<MemoryTarget> = { target, compressed };

    return { sync, value };
};

export const getTestDropBoxSync = async ({ compressed = false }: { compressed?: boolean } = {}): Promise<
    Sync<DropboxTarget>
> => ({
    target: DropboxTarget.deserialise({
        connection: { clientId: "", refreshToken: "", accessToken: "", expiry: new Date().toISOString() },
        user: { id: "", email: "", name: "" },
        path: "/data.bak",
    }),
    compressed,
});
