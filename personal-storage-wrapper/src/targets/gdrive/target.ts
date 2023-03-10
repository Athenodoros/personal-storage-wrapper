import { Result } from "../result";
import { Deserialiser, Target, TargetValue } from "../types";
import { GDriveConnection, GDriveTargetSerialisationConfig, GDriveTargetType, GDriveUserDetails } from "./types";

export class GDriveTarget implements Target<GDriveTargetType, GDriveTargetSerialisationConfig> {
    type: GDriveTargetType = GDriveTargetType;
    private onRefreshNeeded: () => void;
    private connection: GDriveConnection;
    private user: GDriveUserDetails;
    private file: string;

    private constructor(
        connection: GDriveConnection,
        user: GDriveUserDetails,
        file: string,
        onRefreshNeeded: () => void
    ) {
        this.connection = connection;
        this.user = user;
        this.file = file;
        this.onRefreshNeeded = onRefreshNeeded;
    }

    // Data handlers
    timestamp = (): Result<Date | null> =>
        this.fetchJSONRequest<FileDetails>(
            `https://www.googleapis.com/drive/v3/files/${this.file}?fields=modifiedTime`
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
        this.fetchJSONRequest<FileDetails>(
            `https://www.googleapis.com/upload/drive/v3/files/${this.file}?uploadType=media&fields=modifiedTime`,
            {
                method: "PATCH",
                body: new Blob([buffer]),
                // Should probably include mimeType?
                // body: new Blob([buffer], { type: mimeType }),
                // headers: { "Content-Type": mimeType },
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
    fetch = async (input: RequestInfo | URL, init?: RequestInit) =>
        fetch(input, {
            ...init,
            headers: { ...init?.headers, authorization: "Bearer " + this.connection.accessToken },
        });

    private fetchJSONRequest = <T = unknown>(input: RequestInfo | URL, init?: RequestInit): Result<T> =>
        new Result<T>(async (resolve) => {
            const result = await this.fetch(input, init);

            if (result.status === 401) {
                this.onRefreshNeeded();
                return Result.error<T>();
            }

            const json = await result.json();
            resolve(json);
        });
}

interface FileDetails {
    modifiedTime: string;
}
