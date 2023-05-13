import { DropboxTarget } from "personal-storage-wrapper";
import { TestProps } from "../../components/test";

export interface DropboxTest {
    name: string;
    disabled?: (target: DropboxTarget | undefined) => boolean;
    state?: TestProps["state"];
    runner?: (
        logger: (log: string) => void,
        target: DropboxTarget | undefined,
        addTarget: (target: DropboxTarget) => void
    ) => Promise<boolean>;
}
