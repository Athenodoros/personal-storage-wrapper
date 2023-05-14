import { GDriveTarget } from "personal-storage-wrapper";
import {
    getHandleOffline,
    getHandleRevokedAccess,
    getInvalidReference,
    getOldToken,
    getRunOperations,
} from "../utils/operations";
import { TestConfig } from "../utils/tests";

export const GDriveOperationsTests: TestConfig<GDriveTarget>[] = [
    getRunOperations<GDriveTarget>(),
    getOldToken<GDriveTarget>(),
    getHandleRevokedAccess<GDriveTarget>(),
    getHandleOffline<GDriveTarget>(),
    getInvalidReference<GDriveTarget>((serialised) => (serialised.file.id = "BAD_FILE"), GDriveTarget.deserialise),
];
