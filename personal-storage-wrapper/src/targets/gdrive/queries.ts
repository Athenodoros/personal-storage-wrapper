import { noop } from "../../utilities/data";
import { Result } from "../result";
import { constructURLWithQueryParams } from "../utils";
import { runGDriveJSONQuery } from "./requests";
import { GDriveConnection, GDriveUserDetails } from "./types";

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
    runGDriveJSONQuery<GDriveUserMetadata>(
        noop,
        connection,
        "https://www.googleapis.com/drive/v3/about?fields=user"
    ).map((user) => ({ email: user.emailAddress, name: user.displayName }));

/**
 * Query for file
 */
interface QueryResults {
    files: { id: string; name: string; mimeType: string; description: string; modifiedTime: string }[];
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
            fields: "id,modifiedTime",
            orderBy: "modifiedTime desc",
            pageSize: "1",
            spaces: connection.useAppData ? "appDataFolder" : "drive",
            q: query,
        })
    );
};
