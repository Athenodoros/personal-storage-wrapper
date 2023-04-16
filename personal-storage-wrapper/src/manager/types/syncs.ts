import { Target } from "../../targets/types";
import { DefaultTarget } from "../utilities/defaults";

export interface Sync<T extends Target<any, any> = DefaultTarget> {
    // Sync Config
    target: T;
    compressed: boolean;

    // Sync Status
    desynced?: boolean; // Flag for failed writes
    lastSeenWriteTime?: Date; // Last remote timestamp, to detect remote updates
}
