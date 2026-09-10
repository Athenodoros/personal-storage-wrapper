import { Result } from "../result";
import { MAX_RTT_FOR_QUERY_IN_SECONDS } from "../utils";
import { DropboxConnection } from "./types";

const getDropboxAuthorization = (connection: DropboxConnection): Result<string> =>
    new Result(async (resolve) => {
        if (new Date() > connection.expiry) {
            const response = await fetch(
                `https://api.dropboxapi.com/oauth2/token?grant_type=refresh_token&client_id=${connection.clientId}&refresh_token=${connection.refreshToken}`,
                {
                    headers: { "Content-Type": "application/json" },
                    method: "POST",
                }
            );
            const access = await response.json();

            if (
                access["error"] === "invalid_grant" ||
                (access["error_summary"] ?? "").startsWith("invalid_access_token")
            )
                return resolve({ type: "error", error: "INVALID_AUTH" });

            // Update auth object
            connection.accessToken = access.access_token;

            const expiry = new Date();
            expiry.setSeconds(expiry.getSeconds() + (access.expires_in as number) - MAX_RTT_FOR_QUERY_IN_SECONDS);
            connection.expiry = expiry;
        }

        resolve({ type: "value", value: `Bearer ${connection.accessToken}` });
    });

export const runDropboxQuery = (
    connection: DropboxConnection,
    input: RequestInfo | URL,
    init?: RequestInit | undefined,
    // A 401 is worth one forced token refresh, and no more - see below
    retryOnUnauthorized: boolean = true
): Result<Response> =>
    new Result<Response>(async (resolve) => {
        if (!window.navigator.onLine) return resolve({ type: "error", error: "OFFLINE" });

        const authorization = await getDropboxAuthorization(connection);
        if (authorization.type === "error") return resolve(authorization);

        try {
            let result = await fetch(input, {
                ...init,
                headers: { ...init?.headers, authorization: authorization.value },
            });

            if (result.status === 401) {
                /**
                 * The usual reason is an access token that expired earlier than expected, which one
                 * forced refresh fixes. It is not the only reason: an app whose grant is missing a
                 * scope the request needs answers 401 to every attempt, however new the token is.
                 * Retrying unconditionally then loops forever, refreshing and re-requesting, and the
                 * caller simply never hears back - so the second 401 is reported as what it is.
                 */
                if (!retryOnUnauthorized) return resolve({ type: "error", error: "INVALID_AUTH" });

                connection.expiry = new Date("1970-01-01");
                return resolve(await runDropboxQuery(connection, input, init, false));
            }

            return resolve({ type: "value", value: result });
        } catch {
            return resolve({ type: "error", error: "UNKNOWN" });
        }
    });

export const runDropboxQueryForJSON = <T>(
    connection: DropboxConnection,
    input: RequestInfo | URL,
    init?: RequestInit
): Result<T> =>
    runDropboxQuery(connection, input, init)
        .pmap((response) => response.json())
        .flatmap((json) => {
            const error = json["error"] as string | undefined;
            const summary = json["error_summary"] as string | undefined;

            if (summary === undefined) return Result.value(json as T);

            if (error === "invalid_grant") return Result.error("INVALID_AUTH");
            if (summary.startsWith("path/not_found") || summary.startsWith("path_lookup/not_found"))
                return Result.error("MISSING_FILE");
            if (summary.startsWith("path/malformed_path")) return Result.error("INVALID_FILE_REFERENCE");

            return Result.error("UNKNOWN");
        });
