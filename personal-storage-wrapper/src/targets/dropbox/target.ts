import { deepEquals } from "../../utilities/data";
import { Result } from "../result";
import { Deserialiser, Target, TargetValue } from "../types";
import { catchRedirectForAuth, getUserMetadata, redirectForAuth, runAuthInPopup } from "./auth";
import { runDropboxQuery, runDropboxQueryForJSON } from "./requests";
import { DropboxConnection, DropboxTargetSerialisationConfig, DropboxTargetType, DropboxUserDetails } from "./types";

export class DropboxTarget implements Target<DropboxTargetType, DropboxTargetSerialisationConfig> {
    type: DropboxTargetType = DropboxTargetType;
    private connection: DropboxConnection;
    readonly user: DropboxUserDetails;
    readonly path: string;

    private constructor(connection: DropboxConnection, user: DropboxUserDetails, path: string) {
        this.connection = connection;
        this.user = user;
        this.path = path;
    }

    // Constructors for new targets
    static redirectForAuth = (clientId: string, redirectURI?: string): Promise<void> =>
        redirectForAuth(clientId, redirectURI);

    private static createFromMaybeConnection = async (connection: Promise<DropboxConnection | null>, path: string) => {
        const result = await connection;
        if (result === null) return null;

        const user = await getUserMetadata(result);
        if (user.type === "error") return null;

        return new DropboxTarget(result, user.value, path);
    };

    static catchRedirectForAuth = async (path: string = "/data.bak"): Promise<DropboxTarget | null> =>
        this.createFromMaybeConnection(catchRedirectForAuth(), path);

    static setupInPopup = async (
        clientId: string,
        redirectURI?: string,
        path: string = "/data.bak"
    ): Promise<DropboxTarget | null> => this.createFromMaybeConnection(runAuthInPopup(clientId, redirectURI), path);

    // Data handlers
    write = (buffer: ArrayBuffer): Result<Date> =>
        this.fetchJSON<{ server_modified?: string }>("https://content.dropboxapi.com/2/files/upload", {
            method: "POST",
            headers: {
                "Content-Type": "application/octet-stream",
                "Dropbox-API-Arg": `{"path": "${this.path}","mode": "overwrite"}`,
            },
            body: buffer,
        }).flatmap((result) =>
            result?.server_modified ? Result.value(new Date(result.server_modified)) : Result.error("UNKNOWN")
        );

    read = (): Result<TargetValue> =>
        this.getFileMetadata().flatmap((write) => {
            if (write === null) return Result.value(null as TargetValue);

            return this.fetch("https://content.dropboxapi.com/2/files/download", {
                method: "POST",
                headers: { "Dropbox-API-Arg": JSON.stringify({ path: "rev:" + write.rev }) },
            })
                .pmap((response) => response.arrayBuffer())
                .map((buffer) => ({ timestamp: write.server_modified, buffer } as TargetValue));
        });

    timestamp = (): Result<Date | null> => this.getFileMetadata().map((result) => result && result.server_modified);

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
            .map((result) =>
                result?.server_modified && result.rev
                    ? { server_modified: new Date(result.server_modified), rev: result.rev }
                    : null
            );
}

interface FileMetadata {
    server_modified: Date;
    rev: string;
}
