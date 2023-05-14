import { Deserialiser, DropboxTarget, GDriveTarget, Result, TargetValue } from "personal-storage-wrapper";
import { runDropboxQuery } from "../../../../personal-storage-wrapper/src/targets/dropbox/requests";
import { TestConfig } from "../utils/tests";

const file = Uint8Array.from("Hello, World!", (c) => c.charCodeAt(0)).buffer;

export const getRunOperations = <T extends DropboxTarget | GDriveTarget>(saleDeletes: boolean): TestConfig<T> => ({
    name: "Run Basic Operations",
    disabled: (target) => target === undefined,
    runner: async (logger, target) => {
        const expect =
            <T, R>(test: (result: T) => boolean, log: string, next: (value: T) => Result<R>) =>
            (result: T) => {
                if (!test(result)) {
                    console.log(`Operation Incorrect Result before "${log}":`, result);
                    return Result.error("UNKNOWN");
                }

                logger(log);
                return next(result);
            };

        let result = Result.value(null);

        if (saleDeletes) {
            // prettier-ignore
            result = result
                .flatmap<any>(expect(r => r === null, "Deleting file...", () => target!.delete()))
                .flatmap<any>(expect(r => r === null, "Reading timestamp...", () => target!.timestamp()))
                .flatmap<any>(expect(r => r === null, "Reading file...", () => target!.read()));
        }

        // prettier-ignore
        result = result
            .flatmap<any>(expect(r => r === null, "Writing file...", () => target!.write(file)))
            .flatmap<any>(expect(r => r !== null, "Reading timestamp...", () => target!.timestamp()))
            .flatmap<any>(expect(r => r !== null, "Reading file...", () => target!.read()))

        const getValueFromBuffer = (buffer: ArrayBuffer) => String.fromCharCode(...new Uint8Array(buffer));
        const checkArrayBuffer = (targetValue: TargetValue | null) =>
            !!targetValue?.buffer && getValueFromBuffer(targetValue.buffer) === getValueFromBuffer(file);

        if (saleDeletes) {
            // prettier-ignore
            result = result
                .flatmap<any>(expect(checkArrayBuffer, "Deleting file...", () => target!.delete()))
                .flatmap<any>(expect(r => r === null, "Deleting file...", () => target!.delete()))
                .flatmap<any>(expect(r => r === null, "Reading timestamp...", () => target!.timestamp()))
                .flatmap<any>(expect(r => r === null, "Reading file...", () => target!.read()))
        }

        const value = await result;

        if (value.type === "value" && (saleDeletes ? value.value === null : checkArrayBuffer(value.value as any))) {
            logger("Success!");
            return true;
        }

        logger("Incorrect result!");
        return false;
    },
});

export const getHandleRevokedAccess = <T extends DropboxTarget | GDriveTarget>(): TestConfig<T> => ({
    name: "Handles Revoked Access",
    disabled: (target) => target === undefined || !window.navigator.onLine,
    runner: async (logger, target) => {
        logger("Making request...");
        const result = await target!.timestamp();

        if (result.type === "error") {
            if (result.error !== "INVALID_AUTH") {
                logger("Operation returned wrong error!");
                return false;
            }

            logger("Operation returned correct error!");
            return true;
        }

        logger("Operation returned result");
        return false;
    },
});

export const getHandleOffline = <T extends DropboxTarget | GDriveTarget>(): TestConfig<T> => ({
    name: "Handles Being Offline",
    disabled: (target) => target === undefined || window.navigator.onLine,
    runner: async (logger, target) => {
        logger("Making request...");
        const result = await runDropboxQuery(
            (target as any).connection,
            "https://api.dropboxapi.com/2/files/get_metadata",
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ path: (target as any).path }),
            }
        );

        if (result.type === "error") {
            if (result.error !== "OFFLINE") {
                logger("Operation returned incorrect error!");
                return false;
            }

            logger("Operation returned correct error!");
            return true;
        }

        logger("Operation returned result");
        return false;
    },
});

export const getInvalidReference = <T extends DropboxTarget | GDriveTarget>(
    invalidate: (serialised: ReturnType<T["serialise"]>) => void,
    deserialise: Deserialiser<T>
): TestConfig<T> => ({
    name: "Handles Invalid Reference",
    disabled: (target) => target === undefined,
    runner: async (logger, target) => {
        logger("Creating bad target...");

        const serialised = target!.serialise();
        invalidate(serialised as ReturnType<T["serialise"]>);
        const broken = await deserialise(serialised as ReturnType<T["serialise"]>);

        const result = await broken.timestamp();

        if (result.type === "error") {
            if (result.error !== "INVALID_FILE_REFERENCE") {
                logger("Operation returned incorrect error!");
                return false;
            }
            logger("Operation returned correct error!");
            return true;
        }

        logger("Operation returned result");
        return false;
    },
});
