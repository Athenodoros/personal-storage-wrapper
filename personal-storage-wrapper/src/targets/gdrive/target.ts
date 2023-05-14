import { deepEquals, noop } from "../../utilities/data";
import { Result } from "../result";
import { Deserialiser, Target, TargetValue } from "../types";
import { catchRedirectForAuth, redirectForAuth, runAuthInPopup } from "./auth";
import { createNewFile, getUserMetadata, queryForFile } from "./queries";
import { runGDriveJSONQuery, runGDriveQuery } from "./requests";
import {
    GDriveConnection,
    GDriveFileReference,
    GDriveTargetSerialisationConfig,
    GDriveTargetType,
    GDriveUserDetails,
} from "./types";

export class GDriveTarget implements Target<GDriveTargetType, GDriveTargetSerialisationConfig> {
    type: GDriveTargetType = GDriveTargetType;

    static onRefreshNeeded: (target: GDriveTarget) => void = noop;

    private connection: GDriveConnection;
    readonly user: GDriveUserDetails;
    readonly file: GDriveFileReference;

    private constructor(connection: GDriveConnection, user: GDriveUserDetails, file: GDriveFileReference) {
        this.connection = connection;
        this.user = user;
        this.file = file;
    }

    // Constructors for new targets
    static redirectForAuth = redirectForAuth;

    private static createFromConnection = async (
        connection: GDriveConnection,
        file: FileInitDescription
    ): Promise<GDriveTarget | null> => {
        const user = await getUserMetadata(connection);
        if (user.type === "error") return null;

        if ("id" in file) return new GDriveTarget(connection, user.value, { id: file.id, mime: file.mime });
        const files = await queryForFile(noop, connection, file.name, file.mime, file.parent);
        if (files.type === "error") return null;

        if (files.value.files.length > 0)
            return new GDriveTarget(connection, user.value, {
                id: files.value.files[0].id,
                mime: files.value.files[0].mimeType,
            });

        // TODO: create new file
        const fileRef = await createNewFile(noop, connection, file.name, file.mime, file.parent);
        if (fileRef.type === "error") return null;

        return new GDriveTarget(connection, user.value, { id: fileRef.value.id, mime: fileRef.value.mimeType });
    };

    static catchRedirectForAuth = async (
        file: FileInitDescription,
        targets: GDriveTarget[]
    ): Promise<{ type: "new" | "update"; target: GDriveTarget } | null> => {
        const maybeConnection = await catchRedirectForAuth();
        if (maybeConnection === null) return null;
        const { oldAccessToken, ...connection } = maybeConnection;

        const updated = targets.find((target) => target.connection.accessToken === oldAccessToken);
        if (updated) {
            updated.connection = connection;
            return { type: "update", target: updated };
        }

        const created = await this.createFromConnection(connection, file);
        return created && { type: "new", target: created };
    };

    static setupInPopup = async (
        clientId: string,
        redirectURI?: string,
        file: FileInitDescription = { name: "data.bak" },
        useAppData: boolean = true,
        scopes?: string[]
    ): Promise<GDriveTarget | null> => {
        const connection = await runAuthInPopup(clientId, redirectURI, useAppData, scopes);
        return connection && this.createFromConnection(connection, file);
    };

    refreshAuthInPopup = async (redirectURI?: string): Promise<boolean> => {
        const connection = await runAuthInPopup(
            this.connection.clientId,
            redirectURI,
            this.connection.useAppData,
            this.connection.scopes
        );

        if (connection === null) return false;

        const user = await getUserMetadata(connection);
        if (user.type === "error" || user.value.email !== this.user.email) return false;

        this.connection = connection;
        return true;
    };

    redirectForAuthRefresh = (redirectURI?: string): void => {
        redirectForAuth(
            this.connection.clientId,
            redirectURI,
            this.connection.useAppData,
            this.connection.scopes,
            this.connection.accessToken
        );
    };

    // Data handlers
    timestamp = (): Result<Date | null> =>
        this.fetchJSON<{ modifiedTime: string } | null>(
            `https://www.googleapis.com/drive/v3/files/${this.file.id}?fields=modifiedTime`
        )
            .supress("MISSING_FILE", null)
            .map((file) => (file?.modifiedTime ? new Date(file.modifiedTime) : null));
    read = (): Result<TargetValue> =>
        this.timestamp().flatmap(
            (timestamp) =>
                new Result<TargetValue>(async (resolve) => {
                    if (timestamp === null) return resolve({ type: "value", value: null });

                    const response = await this.fetch(
                        `https://www.googleapis.com/drive/v3/files/${this.file.id}?alt=media`
                    );
                    const buffer = await response.arrayBuffer();
                    resolve({ type: "value", value: { timestamp, buffer } });
                })
        );
    write = (buffer: ArrayBuffer): Result<Date> =>
        this.fetchJSON<{ modifiedTime: string }>(
            `https://www.googleapis.com/upload/drive/v3/files/${this.file.id}?uploadType=media&fields=modifiedTime`,
            {
                method: "PATCH",
                body: new Blob([buffer], { type: this.file.mime }),
                headers: this.file.mime ? { "Content-Type": this.file.mime } : undefined,
            }
        ).map((file) => new Date(file.modifiedTime));
    delete = (): Result<null> =>
        this.fetchJSON<unknown>(`https://www.googleapis.com/drive/v3/files/${this.file.id}`, { method: "DELETE" })
            .map(() => null)
            .supress("MISSING_FILE", null);

    // Serialisation
    static deserialise: Deserialiser<GDriveTarget, false> = ({ connection, user, file }) =>
        new GDriveTarget({ ...connection, expiry: new Date(connection.expiry) }, user, file);

    serialise = (): GDriveTargetSerialisationConfig => ({
        connection: { ...this.connection, expiry: this.connection.expiry.toISOString() },
        user: this.user,
        file: this.file,
    });

    // Error Handling
    online = () => navigator.onLine;
    equals = (other: Target<any, any>): boolean =>
        other instanceof GDriveTarget &&
        deepEquals(
            [other.connection.clientId, other.connection.useAppData, other.user.email, other.file.id],
            [this.connection.clientId, this.connection.useAppData, this.user.email, this.file.id]
        );

    // Other requests
    fetch = (input: RequestInfo | URL, init?: RequestInit) => runGDriveQuery(this.connection, input, init);
    fetchJSON = <T = unknown>(input: RequestInfo | URL, init?: RequestInit): Result<T> =>
        runGDriveJSONQuery(() => GDriveTarget.onRefreshNeeded(this), this.connection, input, init);

    getFileDetails = () =>
        this.fetchJSON<{ mimeType: string; name: string }>(`https://www.googleapis.com/drive/v3/files/${this.file.id}`);
}

type FileInitDescription = { id: string; mime: string } | { name: string; mime?: string; parent?: string };
