import { DropboxTarget, Result, TargetValue } from "personal-storage-wrapper";
import { TestConfig } from "../tests";

const file = Uint8Array.from("Hello, World!", (c) => c.charCodeAt(0)).buffer;

const RunOperations: TestConfig<DropboxTarget> = {
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
};

const OldToken: TestConfig<DropboxTarget> = {
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
};

const HandleRevokedAccess: TestConfig<DropboxTarget> = {
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
};

const HandleOffline: TestConfig<DropboxTarget> = {
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
};

const InvalidPath: TestConfig<DropboxTarget> = {
    name: "Handles Invalid Paths",
    disabled: (target) => target === undefined,
    runner: async (logger, target) => {
        logger("Creating bad target...");

        const serialised = target!.serialise();
        serialised.path = "//";
        const broken = DropboxTarget.deserialise(serialised);

        const result = await broken.timestamp();

        if (result.type === "error") {
            logger("Operation returned an error!");
            return true;
        }

        logger("Operation returned result");
        return false;
    },
};

export const OperationsTests: TestConfig<DropboxTarget>[] = [
    RunOperations,
    OldToken,
    HandleRevokedAccess,
    HandleOffline,
    InvalidPath,
];
