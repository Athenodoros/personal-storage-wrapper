import { Target } from "../../targets/types";
import { DefaultTarget } from "../utilities/defaults";

export interface Sync<T extends Target<any, any> = DefaultTarget> {
    // Sync Config
    target: T;
    compressed: boolean;

    // Sync Status
    status: SyncStatus;

    lastSeenValueTimestamp?: Date | null; // What a write to the target expects, from this session's last look: its value's timestamp, or null for none. Not saved.
    lastProcessedWriteTime?: Date; // The target's timestamp for the last value the manager wrote, took on, or found unreadable
}

/**
 * How a target stands against the manager's value. Only whether it is behind is remembered between
 * sessions, and sent to other contexts: each finds out for itself why, and whether it can read it.
 */
export type SyncStatus =
    /** Nothing the manager has saved is missing from the target, as far as it knows */
    | { type: "IN_STEP" }
    /** The target may not hold the manager's latest value, so it is checked before it is written again */
    | { type: "BEHIND"; cause: BehindCause }
    /**
     * The target holds a value that could not be decoded, or that failed the manager's `validate`. It is
     * never written to, so that whatever is there is never lost to a write that did not know about it.
     */
    | { type: "UNREADABLE" };

export type BehindCause =
    /** The target couldn't be reached */
    | "OFFLINE"
    /** Something else wrote over the target, or deleted it, since the manager last looked: a poll reads it */
    | "MOVED_ON"
    /** A request failed for another reason, such as a refused authorisation, which may not pass by itself */
    | "FAILED"
    /** Behind when an earlier session saved the syncs, or another context sent them, neither of which says why */
    | "INHERITED";

/**
 * A sync as an application gives it to a manager, to start with or to add. A sync with no status
 * starts in step, as one that nothing has been saved to yet has missed nothing.
 */
export type NewSync<T extends Target<any, any> = DefaultTarget> = Omit<Sync<T>, "status"> &
    Partial<Pick<Sync<T>, "status">>;

/** The sync itself where it has a status, since the manager works on the objects it is given */
export const toSync = <T extends Target<any, any>>(sync: NewSync<T>): Sync<T> =>
    sync.status ? (sync as Sync<T>) : { ...sync, status: { type: "IN_STEP" } };

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
