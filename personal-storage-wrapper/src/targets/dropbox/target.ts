import { deepEquals } from "../../utilities/data";
import { Result } from "../result";
import { Deserialiser, Target, TargetValue } from "../types";
import { catchRedirectForAuth, getUserMetadata, redirectForAuth, runAuthInPopup } from "./auth";
import { runDropboxQuery, runDropboxQueryForJSON } from "./requests";
import { getRevisionTime } from "./revisions";
import { DropboxConnection, DropboxTargetSerialisationConfig, DropboxTargetType, DropboxUserDetails } from "./types";

export class DropboxTarget implements Target<DropboxTargetType, DropboxTargetSerialisationConfig> {
    type: DropboxTargetType = DropboxTargetType;
    private connection: DropboxConnection;
    readonly user: DropboxUserDetails;
    readonly path: string;

    private seen: SeenFile = { type: "UNKNOWN" };

    private constructor(connection: DropboxConnection, user: DropboxUserDetails, path: string) {
        this.connection = connection;
        this.user = user;
        this.path = path;
    }

    // Constructors for new targets
    static redirectForAuth = (clientId: string, redirectURI?: string): Promise<void> =>
        redirectForAuth(clientId, redirectURI);

    /**
     * A target for a connection, once Dropbox has said whose account it is. Null, with no connection,
     * means the user didn't sign in; anything that went wrong once they had is an error.
     */
    private static createFromMaybeConnection = (
        connection: Result<DropboxConnection | null>,
        path: string
    ): Result<DropboxTarget | null> =>
        connection.flatmap((result) =>
            result === null
                ? Result.value<DropboxTarget | null>(null)
                : getUserMetadata(result).map<DropboxTarget | null>((user) => new DropboxTarget(result, user, path))
        );

    static catchRedirectForAuth = (path: string = "/data.bak"): Result<DropboxTarget | null> =>
        this.createFromMaybeConnection(catchRedirectForAuth(), path);

    /**
     * A target for a refresh token obtained some other way, such as one an application kept from before
     * it used this library. Asking Dropbox whose account it is also checks that the token still works.
     */
    static fromRefreshToken = (clientId: string, refreshToken: string, path: string): Result<DropboxTarget> => {
        const connection = { clientId, refreshToken, accessToken: "", expiry: new Date(0) };
        return getUserMetadata(connection).map((user) => new DropboxTarget(connection, user, path));
    };

    /** The same account, at another path. The two share a connection, so a refreshed token serves both. */
    withPath = (path: string): DropboxTarget => new DropboxTarget(this.connection, this.user, path);

    static setupInPopup = (
        clientId: string,
        redirectURI?: string,
        path: string = "/data.bak"
    ): Result<DropboxTarget | null> => this.createFromMaybeConnection(runAuthInPopup(clientId, redirectURI), path);

    // Data handlers
    write = (buffer: ArrayBuffer, expectedValueTimestamp?: Date | null): Result<Date> => {
        const mode = this.getWriteMode(expectedValueTimestamp);
        if (mode === null) return Result.error("CONFLICT", "The file isn't at the revision the write expected");

        return this.fetchJSON<{ server_modified?: string; rev?: string }>(
            "https://content.dropboxapi.com/2/files/upload",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/octet-stream",
                    "Dropbox-API-Arg": JSON.stringify({ path: this.path, mode }),
                },
                body: buffer,
            }
        ).flatmap((result) => {
            if (!result?.server_modified)
                return Result.error<Date>("UNKNOWN", "Dropbox accepted the upload without saying when it was saved");

            const timestamp = getRevisionTime(new Date(result.server_modified), result.rev);
            this.seen = result.rev ? { type: "REVISION", timestamp, rev: result.rev } : { type: "UNKNOWN" };
            return Result.value(timestamp);
        });
    };

    // Dropbox refuses an update of a revision that has been replaced, and an add over an existing file
    private getWriteMode = (expectedValueTimestamp: Date | null | undefined) => {
        if (expectedValueTimestamp === undefined) return "overwrite";
        if (expectedValueTimestamp === null) return "add";
        if (this.seen.type === "REVISION" && this.seen.timestamp.valueOf() === expectedValueTimestamp.valueOf())
            return { ".tag": "update", update: this.seen.rev };
        return null; // A revision this target hasn't seen can't be checked
    };

    read = (): Result<TargetValue> =>
        this.getFileMetadata().flatmap((write) => {
            if (write === null) return Result.value(null as TargetValue);

            return this.fetch("https://content.dropboxapi.com/2/files/download", {
                method: "POST",
                headers: { "Dropbox-API-Arg": JSON.stringify({ path: "rev:" + write.rev }) },
            })
                .pmap((response) => response.arrayBuffer())
                .map((buffer) => ({ timestamp: write.timestamp, buffer } as TargetValue));
        });

    timestamp = (): Result<Date | null> => this.getFileMetadata().map((result) => result && result.timestamp);

    delete = (): Result<null> =>
        this.fetchJSON<unknown>("https://api.dropboxapi.com/2/files/delete_v2", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ path: this.path }),
        })
            .supress("MISSING_FILE", null)
            .map(() => null);

    // Serialisation
    static deserialise: Deserialiser<DropboxTarget, false> = ({ connection, user, path }) =>
        new DropboxTarget({ ...connection, expiry: new Date(connection.expiry) }, user, path);

    serialise = (): DropboxTargetSerialisationConfig => ({
        connection: { ...this.connection, expiry: this.connection.expiry.toISOString() },
        user: this.user,
        path: this.path,
    });

    // Error Handling
    online = () => navigator.onLine;
    equals = (other: Target<any, any>): boolean =>
        other instanceof DropboxTarget &&
        deepEquals(
            [other.connection.clientId, other.user.id, other.path],
            [this.connection.clientId, this.user.id, this.path]
        );

    // Other requests
    // This should probably track when the connection is changed and run callbacks
    fetch = (input: RequestInfo | URL, init?: RequestInit) => runDropboxQuery(this.connection, input, init);
    fetchJSON = <T>(input: RequestInfo | URL, init?: RequestInit) =>
        runDropboxQueryForJSON<T>(this.connection, input, init);

    private getFileMetadata = (): Result<FileMetadata | null> =>
        this.fetchJSON<{ server_modified?: string; rev?: string } | null>(
            "https://api.dropboxapi.com/2/files/get_metadata",
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ path: this.path }),
            }
        )
            .supress("MISSING_FILE", null)
            .map((result) => {
                const metadata =
                    result?.server_modified && result.rev
                        ? { timestamp: getRevisionTime(new Date(result.server_modified), result.rev), rev: result.rev }
                        : null;
                this.seen = metadata ? { type: "REVISION", ...metadata } : { type: "MISSING" };
                return metadata;
            });
}

interface FileMetadata {
    /** When this revision was saved, to the millisecond: see `getRevisionTime` */
    timestamp: Date;
    rev: string;
}

/** What a target last found at its path: nothing yet, no file, or a revision of it */
type SeenFile = { type: "UNKNOWN" } | { type: "MISSING" } | ({ type: "REVISION" } & FileMetadata);
