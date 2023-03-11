import { Result } from "../result";
import { Deserialiser, Target, TargetValue } from "../types";
import { catchRedirectForAuth, redirectForAuth, runAuthInPopup } from "./auth";
import { getUserMetadata, queryForFile } from "./queries";
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
    private onRefreshNeeded: () => void;
    private connection: GDriveConnection;
    private user: GDriveUserDetails;
    private file: GDriveFileReference;

    private constructor(
        connection: GDriveConnection,
        user: GDriveUserDetails,
        file: GDriveFileReference,
        onRefreshNeeded: () => void
    ) {
        this.connection = connection;
        this.user = user;
        this.file = file;
        this.onRefreshNeeded = onRefreshNeeded;
    }

    // Constructors for new targets
    static redirectForAuth = redirectForAuth;

    private static createFromMaybeConnection = async (
        connection: Promise<GDriveConnection | null>,
        onRefreshNeeded: () => void,
        file: FileInitDescription
    ): Promise<GDriveTarget | null> => {
        const result = await connection;
        if (result === null) return null;

        const user = await getUserMetadata(result);
        if (user.type === "error") return null;

        if (file.type === "id")
            return new GDriveTarget(result, user.value, { id: file.id, mime: file.mime }, onRefreshNeeded);
        const files = await queryForFile(onRefreshNeeded, result, file.name, file.mime, file.parent);
        if (files.type === "error" || files.value.files.length === 0) return null;

        return new GDriveTarget(
            result,
            user.value,
            { id: files.value.files[0].id, mime: files.value.files[0].mimeType },
            onRefreshNeeded
        );
    };

    static catchRedirectForAuth = async (
        clientId: string,
        onRefreshNeeded: () => void,
        file: FileInitDescription,
        useAppData: boolean = true,
        redirectURI?: string
    ): Promise<GDriveTarget | null> =>
        this.createFromMaybeConnection(catchRedirectForAuth(clientId, useAppData, redirectURI), onRefreshNeeded, file);

    static setupInPopup = async (
        clientId: string,
        onRefreshNeeded: () => void,
        file: FileInitDescription,
        useAppData: boolean = true,
        redirectURI?: string,
        scopes?: string[]
    ): Promise<GDriveTarget | null> =>
        this.createFromMaybeConnection(
            runAuthInPopup(clientId, useAppData, redirectURI, scopes),
            onRefreshNeeded,
            file
        );

    // Data handlers
    timestamp = (): Result<Date | null> =>
        this.fetchJSON<FileDetails>(`https://www.googleapis.com/drive/v3/files/${this.file}?fields=modifiedTime`).map(
            (file) => (file ? new Date(file.modifiedTime) : null)
        );
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

    // Serialisation
    static createDeserialiseHandler =
        (onRefreshNeeded: () => void): Deserialiser<GDriveTargetType, GDriveTargetSerialisationConfig> =>
        ({ connection, user, file }) =>
            Promise.resolve(new GDriveTarget(connection, user, file, onRefreshNeeded));

    serialise = (): GDriveTargetSerialisationConfig => ({
        connection: this.connection,
        user: this.user,
        file: this.file,
    });

    // Other requests
    fetch = (input: RequestInfo | URL, init?: RequestInit) => runGDriveQuery(this.connection, input, init);
    fetchJSON = <T = unknown>(input: RequestInfo | URL, init?: RequestInit): Result<T> =>
        runGDriveJSONQuery(this.onRefreshNeeded, this.connection, input, init);
}

interface FileDetails {
    modifiedTime: string;
}

type FileInitDescription =
    | { type: "id"; id: string; mime: string }
    | { type: "name"; name: string; mime?: string; parent?: string };
