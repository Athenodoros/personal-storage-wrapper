import { Result } from "../result";
import { GDriveConnection } from "./types";

export const runGDriveQuery = (
    connection: GDriveConnection,
    input: RequestInfo | URL,
    init?: RequestInit | undefined
): Promise<Response> =>
    fetch(input, { ...init, headers: { ...init?.headers, authorization: "Bearer " + connection.accessToken } });

export const runGDriveJSONQuery = <T = unknown>(
    onRefreshNeeded: () => void,
    connection: GDriveConnection,
    input: RequestInfo | URL,
    init?: RequestInit
): Result<T> =>
    new Result<T>(async (resolve) => {
        if (!window.navigator.onLine) return resolve({ type: "error", error: "OFFLINE" });

        if (connection.expiry < new Date()) {
            onRefreshNeeded();
            resolve({ type: "error", error: "EXPIRED_AUTH" });
            return;
        }

        try {
            const result = await runGDriveQuery(connection, input, init);

            if (result.status === 401) {
                onRefreshNeeded();
                resolve({ type: "error", error: "INVALID_AUTH" });
                return;
            }

            const json = await result.json();

            if (result.status === 404) {
                if (json["error"]["message"].startsWith("File not found"))
                    resolve({ type: "error", error: "INVALID_FILE_REFERENCE" });
            }

            resolve({ type: "value", value: json as T });
        } catch {
            return resolve({ type: "error", error: "UNKNOWN" });
        }
    });
