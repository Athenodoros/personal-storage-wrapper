import { getUnknownError, Result } from "../result";
import { MAX_RTT_FOR_QUERY_IN_SECONDS } from "../utils";
import { DropboxConnection } from "./types";

/**
 * The connection's access token, refreshed first if it has expired. A refresh that Dropbox refuses
 * because the grant is gone is INVALID_AUTH; anything else that goes wrong with it - the network, or
 * an answer without a token in it - is reported with whatever Dropbox said, rather than leaving the
 * connection holding an access token of `undefined`.
 */
const getDropboxAuthorization = (connection: DropboxConnection): Result<string> =>
    new Result(async (resolve) => {
        // An expiry that isn't a date at all - a connection deserialised from something odd - is refreshed too
        if (!(connection.expiry.valueOf() > Date.now())) {
            const response = await fetch(
                `https://api.dropboxapi.com/oauth2/token?grant_type=refresh_token&client_id=${connection.clientId}&refresh_token=${connection.refreshToken}`,
                {
                    headers: { "Content-Type": "application/json" },
                    method: "POST",
                },
            );
            const access = await readJSON(response);

            if (
                access["error"] === "invalid_grant" ||
                (access["error_summary"] ?? "").startsWith("invalid_access_token")
            )
                return resolve({ type: "error", error: "INVALID_AUTH", detail: getDropboxErrorDetail(access) });

            if (typeof access.access_token !== "string" || typeof access.expires_in !== "number")
                return resolve({
                    type: "error",
                    error: "UNKNOWN",
                    detail: getDropboxErrorDetail(access) ?? `Dropbox did not refresh the token (${response.status})`,
                });

            // Update auth object
            connection.accessToken = access.access_token;

            const expiry = new Date();
            expiry.setSeconds(expiry.getSeconds() + access.expires_in - MAX_RTT_FOR_QUERY_IN_SECONDS);
            connection.expiry = expiry;
        }

        resolve({ type: "value", value: `Bearer ${connection.accessToken}` });
    });

/** A response's JSON, or an empty object for a body that isn't JSON - an error page from a proxy, say */
const readJSON = (response: Response): Promise<Record<string, any>> =>
    response.json().then(
        (json) => (json !== null && typeof json === "object" ? json : {}),
        () => ({}),
    );

/**
 * What Dropbox said was wrong, where it said anything. The API's errors carry an `error_summary`,
 * such as `missing_scope/..`, and OAuth's an `error_description`.
 */
export const getDropboxErrorDetail = (json: Record<string, any>): string | undefined =>
    (typeof json["error_summary"] === "string" && json["error_summary"]) ||
    (typeof json["error_description"] === "string" && json["error_description"]) ||
    (typeof json["error"] === "string" && json["error"]) ||
    undefined;

export const runDropboxQuery = (
    connection: DropboxConnection,
    input: RequestInfo | URL,
    init?: RequestInit | undefined,
    // A 401 is worth one forced token refresh, and no more - see below
    retryOnUnauthorized: boolean = true,
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
                if (!retryOnUnauthorized)
                    return resolve({
                        type: "error",
                        error: "INVALID_AUTH",
                        detail: getDropboxErrorDetail(await readJSON(result)),
                    });

                connection.expiry = new Date("1970-01-01");
                return resolve(await runDropboxQuery(connection, input, init, false));
            }

            return resolve({ type: "value", value: result });
        } catch (thrown) {
            // Usually the network, which fetch reports by throwing rather than by a status
            return resolve(getUnknownError(thrown));
        }
    });

export const runDropboxQueryForJSON = <T>(
    connection: DropboxConnection,
    input: RequestInfo | URL,
    init?: RequestInit,
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

            // Dropbox's own description of what it refused, which is the most useful thing there is
            return Result.error<T>("UNKNOWN", summary);
        });
