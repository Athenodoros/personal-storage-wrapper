import { DropboxTarget } from "personal-storage-wrapper";

export interface DropboxTest {
    name: string;
    disabled?: (target: DropboxTarget | undefined) => boolean;
    runner?: (
        logger: (log: string) => void,
        target: DropboxTarget | undefined,
        addTarget: (target: DropboxTarget) => void
    ) => Promise<boolean>;
}
