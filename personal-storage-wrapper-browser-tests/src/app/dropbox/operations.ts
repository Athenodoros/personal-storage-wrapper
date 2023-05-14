import { DropboxTarget } from "personal-storage-wrapper";
import {
    getHandleOffline,
    getHandleRevokedAccess,
    getInvalidReference,
    getOldToken,
    getRunOperations,
} from "../utils/operations";
import { TestConfig } from "../utils/tests";

export const DropboxOperationsTests: TestConfig<DropboxTarget>[] = [
    getRunOperations<DropboxTarget>(),
    getOldToken<DropboxTarget>(),
    getHandleRevokedAccess<DropboxTarget>(),
    getHandleOffline<DropboxTarget>(),
    getInvalidReference<DropboxTarget>((serialised) => (serialised.path = "//"), DropboxTarget.deserialise),
];
