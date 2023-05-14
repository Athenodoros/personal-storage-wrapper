import { Deserialiser, DropboxTarget, GDriveTarget, Result, TargetValue } from "personal-storage-wrapper";
import { TestConfig } from "../utils/tests";

const file = Uint8Array.from("Hello, World!", (c) => c.charCodeAt(0)).buffer;

export const getRunOperations = <T extends DropboxTarget | GDriveTarget>(): TestConfig<T> => ({
    name: "Run Basic Operations",
    disabled: (target) => target === undefined,
    runner: async (logger, target) => {
        const expect =
            <T, R>(test: (result: T) => boolean, log: string, next: (value: T) => Result<R>) =>
            (result: T) => {
                if (!test(result)) {
                    console.log(result);
                    return Result.error();
                }

                logger(log);
                return next(result);
            };

        // prettier-ignore
        const result = await Result.value(null)
            .flatmap(expect(r => r === null, "Deleting file...", () => target!.delete()))
            .flatmap(expect(r => r === null, "Reading timestamp...", () => target!.timestamp()))
            .flatmap(expect(r => r === null, "Reading file...", () => target!.read()))
            .flatmap(expect(r => r === null, "Writing file...", () => target!.write(file)))
            .flatmap(expect(r => r !== null, "Reading timestamp...", () => target!.timestamp()))
            .flatmap(expect(r => r !== null, "Reading file...", () => target!.read()))
            .flatmap(expect(
                r => String.fromCharCode(...new Uint8Array((r as TargetValue)?.buffer ?? new ArrayBuffer(0)))
                     === String.fromCharCode(...new Uint8Array(file)),
                "Deleting file...",
                () => target!.delete())
            )
            .flatmap(expect(r => r === null, "Deleting file...", () => target!.delete()))
            .flatmap(expect(r => r === null, "Reading timestamp...", () => target!.timestamp()))
            .flatmap(expect(r => r === null, "Reading file...", () => target!.read()))

        if (result.type === "value" && result.value === null) {
            logger("Success!");
            return true;
        }

        logger("Incorrect result!");
        return false;
    },
});

export const getOldToken = <T extends DropboxTarget | GDriveTarget>(): TestConfig<T> => ({
    name: "Refresh Old Token",
    disabled: (target) => target === undefined || (target as any).connection.expiry >= new Date(),
    runner: async (logger, target) => {
        logger("Reading timestamp with old token...");
        const result = await target!.timestamp();

        if (result.type === "error") {
            logger("Operation returned an error!");
            return false;
        }

        if ((target as any).connection.expiry < new Date()) {
            logger("Target did not store renewed token!");
            return false;
        }

        logger("Refresh successful!");
        return true;
    },
});

export const getHandleRevokedAccess = <T extends DropboxTarget | GDriveTarget>(): TestConfig<T> => ({
    name: "Handles Revoked Access",
    disabled: (target) => target === undefined || !window.navigator.onLine,
    runner: async (logger, target) => {
        logger("Making request...");
        const result = await target!.timestamp();

        if (result.type === "error") {
            logger("Operation returned an error!");
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
        const result = await target!.timestamp();

        if (result.type === "error") {
            logger("Operation returned an error!");
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
            logger("Operation returned an error!");
            return true;
        }

        logger("Operation returned result");
        return false;
    },
});
