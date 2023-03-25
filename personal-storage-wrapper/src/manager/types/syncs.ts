import { Target } from "../../targets/types";

export interface Sync<Type extends string, Config> {
    // Sync Config
    target: Target<Type, Config>;
    compressed: boolean;

    // Sync Status
    desynced?: boolean; // Flag for failed writes
    lastSeenWriteTime?: Date; // Last remote timestamp, to detect remote updates
}
