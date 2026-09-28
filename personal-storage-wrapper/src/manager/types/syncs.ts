import { Target } from "../../targets/types";
import { DefaultTarget } from "../utilities/defaults";

export interface Sync<T extends Target<any, any> = DefaultTarget> {
    // Sync Config
    target: T;
    compressed: boolean;

    // Sync Status
    desynced?: boolean; // Flag for failed writes
    /**
     * The target holds a value that could not be decoded, or that failed the manager's `validate`.
     * Nothing is written to it while this is set, so that whatever is there is never lost to a write
     * that did not know about it. A later read of a usable value clears it. Like `desynced`, it is
     * not remembered between sessions: each startup reads every target again.
     */
    unreadable?: boolean;
    lastSeenWriteTime?: Date; // Last remote timestamp, to detect remote updates
}

/**
 * Where a manager's value came from when it was created: read from a target, the initial value it was
 * given because every target was empty, or the value `handleAllEmptyAndFailedSyncsOnStartup` supplied.
 */
export type StartSource = "TARGET" | "INITIAL" | "FALLBACK";

/**
 * Where a manager's syncs came from when it was created: the list it saved, the defaults because
 * nothing was saved, or the defaults because the saved list couldn't be read. That last one means any
 * targets the list held, and whatever was needed to reach them, have been dropped.
 */
export type SyncsSource = "SAVED" | "DEFAULT" | "UNREADABLE";

/**
 * Which syncs a value was saved to. A write is batched with any others queued alongside it, so a sync
 * listed as saved holds this value or a later one. A sync that was not written to - because a write to
 * it failed earlier, or it holds a value that couldn't be read - is listed as failed.
 */
export interface SaveResult<T extends Target<any, any> = DefaultTarget> {
    saved: Sync<T>[];
    failed: Sync<T>[];
}
