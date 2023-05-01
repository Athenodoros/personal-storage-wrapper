import { Result } from "../result";
import { MAX_RTT_FOR_QUERY_IN_SECONDS } from "../utils";
import { DropboxConnection } from "./types";

const getDropboxAuthorization = async (connection: DropboxConnection): Promise<string> =>
    new Promise(async (resolve) => {
        if (new Date() > connection.expiry) {
            const response = await fetch(
                `https://api.dropboxapi.com/oauth2/token?grant_type=refresh_token&client_id=${connection.clientId}&refresh_token=${connection.refreshToken}`,
                {
                    headers: { "Content-Type": "application/json" },
                    method: "POST",
                }
            );
            const access = await response.json();

            // Update auth object
            connection.accessToken = access.access_token;

            const expiry = new Date();
            expiry.setSeconds(expiry.getSeconds() + (access.expires_in as number) - MAX_RTT_FOR_QUERY_IN_SECONDS);
            connection.expiry = expiry;
        }

        resolve(`Bearer ${connection.accessToken}`);
    });

export const runDropboxQuery = async (
    connection: DropboxConnection,
    input: RequestInfo | URL,
    init?: RequestInit | undefined
): Promise<Response> => {
    const authorization = await getDropboxAuthorization(connection);
    let result = await fetch(input, { ...init, headers: { ...init?.headers, authorization } });

    if (result.status === 401) {
        connection.expiry = new Date("1970-01-01");
        return runDropboxQuery(connection, input, init);
    }
    return result;
};

export const runDropboxQueryForJSON = <T = unknown>(
    connection: DropboxConnection,
    input: RequestInfo | URL,
    init?: RequestInit,
    errorPrefixes: Record<string, T> = {}
) =>
    new Result<T>((resolve) =>
        runDropboxQuery(connection, input, init)
            .then((response) => response.json())
            .then((json) => {
                const summary = json["error_summary"] as string | undefined;

                if (summary === undefined) return resolve({ type: "value", value: json });

                for (const key in errorPrefixes) {
                    if (summary.startsWith(key)) {
                        return resolve({ type: "value", value: errorPrefixes[key] });
                    }
                }

                return resolve({ type: "error" });
            })
            .catch(() => resolve({ type: "error" }))
    );
