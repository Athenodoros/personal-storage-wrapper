import { Result } from "personal-storage-wrapper";
import { encodeToArrayBuffer } from "../../../../personal-storage-wrapper/src/utilities/buffers/encoding";
import { DropboxTest } from "./types";

const file = encodeToArrayBuffer("Hello, World!");

export const RunOperations: DropboxTest = {
    name: "Run Basic Operations",
    disabled: (target) => target === undefined,
    runner: async (logger, target) => {
        if (!target) {
            logger("No available target!");
            return false;
        }

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
            .flatmap(expect(r => r === null, "Deleting file...", () => target.delete()))
            .flatmap(expect(r => r === null, "Reading timestamp...", () => target.timestamp()))
            .flatmap(expect(r => r === null, "Reading file...", () => target.read()))
            .flatmap(expect(r => r === null, "Writing file...", () => target.write(file)))
            .flatmap(expect(r => r !== null, "Reading timestamp...", () => target.timestamp()))
            .flatmap(expect(r => r !== null, "Reading file...", () => target.read()))
            .flatmap(expect(r => r !== null, "Deleting file...", () => target.delete()))
            .flatmap(expect(r => r === null, "Deleting file...", () => target.delete()))
            .flatmap(expect(r => r === null, "Reading timestamp...", () => target.timestamp()))
            .flatmap(expect(r => r === null, "Reading file...", () => target.read()))

        if (result.type === "value" && result.value === null) {
            logger("Success!");
            return true;
        }

        logger("Incorrect result!");
        return false;
    },
};

export const OldToken: DropboxTest = {
    name: "Refresh Old Token",
    disabled: (target) => target === undefined || (target as any).connection.expiry >= new Date(),
    runner: async (logger, target) => {
        if (!target) {
            logger("No available target!");
            return false;
        }

        logger("Reading timestamp with old token...");
        const result = await target.timestamp();

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
