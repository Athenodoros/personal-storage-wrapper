import { noop } from "../../utilities/data";
import { Result } from "../result";
import { constructURLWithQueryParams } from "../utils";
import { runGDriveJSONQuery } from "./requests";
import { GDriveConnection, GDriveUserDetails } from "./types";

interface GDriveFile {
    id: string;
    name: string;
    mimeType: string;
    description: string;
    modifiedTime: string;
}

/**
 * Get user metadata
 */
interface GDriveUserMetadata {
    kind: "drive#user";
    displayName: string;
    photoLink: string;
    me: boolean;
    permissionId: string;
    emailAddress: string;
}
export const getUserMetadata = (connection: GDriveConnection): Result<GDriveUserDetails> =>
    runGDriveJSONQuery<{ user: GDriveUserMetadata }>(
        noop,
        connection,
        "https://www.googleapis.com/drive/v3/about?fields=user"
    ).map(({ user }) => ({ email: user.emailAddress, name: user.displayName }));

/**
 * Query for file
 */
interface QueryResults {
    files: GDriveFile[];
}
export const queryForFile = (
    onRefreshNeeded: () => void,
    connection: GDriveConnection,
    name: string,
    mime?: string,
    parent?: string
) => {
    let query = `name = '${name}'`;
    if (mime) query += ` and mimeType = '${mime}'`;
    if (parent) query += ` and '${parent}' in parents`;

    return runGDriveJSONQuery<QueryResults>(
        onRefreshNeeded,
        connection,
        constructURLWithQueryParams("https://www.googleapis.com/drive/v3/files", {
            fields: "files(id,modifiedTime)",
            orderBy: "modifiedTime desc",
            pageSize: "1",
            spaces: connection.useAppData ? "appDataFolder" : "drive",
            q: query,
        })
    );
};

/**
 * Create new file
 */
export const createNewFile = (
    onRefreshNeeded: () => void,
    connection: GDriveConnection,
    name: string,
    mime?: string,
    parent?: string
) => {
    return runGDriveJSONQuery<GDriveFile>(onRefreshNeeded, connection, "https://www.googleapis.com/drive/v3/files", {
        method: "POST",
        headers: mime ? { "Content-Type": mime } : undefined,
        body: JSON.stringify({
            mimeType: mime,
            name,
            parents: parent ? [parent] : connection.useAppData ? ["appDataFolder"] : undefined,
        }),
    });
};
