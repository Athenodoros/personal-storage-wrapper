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

    private static createFromMaybeConnection = async (
        connection: Promise<GDriveConnection | null>,
        file: FileInitDescription
    ): Promise<GDriveTarget | null> => {
        const result = await connection;
        if (result === null) return null;

        const user = await getUserMetadata(result);
        if (user.type === "error") return null;

        if ("id" in file) return new GDriveTarget(result, user.value, { id: file.id, mime: file.mime });
        const files = await queryForFile(noop, result, file.name, file.mime, file.parent);
        if (files.type === "error") return null;

        if (files.value.files.length > 0)
            return new GDriveTarget(result, user.value, {
                id: files.value.files[0].id,
                mime: files.value.files[0].mimeType,
            });

        // TODO: create new file
        const fileRef = await createNewFile(noop, result, file.name, file.mime, file.parent);
        if (fileRef.type === "error") return null;

        return new GDriveTarget(result, user.value, { id: fileRef.value.id, mime: fileRef.value.mimeType });
    };

    static catchRedirectForAuth = async (file: FileInitDescription): Promise<GDriveTarget | null> =>
        this.createFromMaybeConnection(catchRedirectForAuth(), file);

    static setupInPopup = async (
        clientId: string,
        redirectURI?: string,
        file: FileInitDescription = { name: "data.bak" },
        useAppData: boolean = true,
        scopes?: string[]
    ): Promise<GDriveTarget | null> =>
        this.createFromMaybeConnection(runAuthInPopup(clientId, useAppData, redirectURI, scopes), file);

    // Data handlers
    timestamp = (): Result<Date | null> =>
        this.fetchJSON<FileDetails>(
            `https://www.googleapis.com/drive/v3/files/${this.file.id}?fields=modifiedTime`
        ).map((file) => (file ? new Date(file.modifiedTime) : null));
    read = (): Result<TargetValue> =>
        this.timestamp().flatmap(
            (timestamp) =>
                new Result<TargetValue>(async (resolve) => {
                    if (timestamp === null) return resolve({ type: "value", value: null });

                    const response = await this.fetch(
                        `https://www.googleapis.com/drive/v3/files/${this.file}?alt=media`
                    );
                    const buffer = await response.arrayBuffer();
                    resolve({ type: "value", value: { timestamp, buffer } });
                })
        );
    write = (buffer: ArrayBuffer): Result<Date> =>
        this.fetchJSON<FileDetails>(
            `https://www.googleapis.com/upload/drive/v3/files/${this.file}?uploadType=media&fields=modifiedTime`,
            {
                method: "PATCH",
                body: new Blob([buffer], { type: this.file.mime }),
                headers: { "Content-Type": this.file.mime },
            }
        ).map((file) => new Date(file.modifiedTime));
    delete = (): Result<null> =>
        this.fetchJSON<unknown>(`https://www.googleapis.com/drive/v3/files/${this.file}`, { method: "DELETE" }).map(
            () => null
        );

    // Serialisation
    static deserialise: Deserialiser<GDriveTarget, false> = ({ connection, user, file }) =>
        new GDriveTarget(connection, user, file);

    serialise = (): GDriveTargetSerialisationConfig => ({
        connection: this.connection,
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
}

interface FileDetails {
    modifiedTime: string;
}

type FileInitDescription = { id: string; mime: string } | { name: string; mime?: string; parent?: string };
