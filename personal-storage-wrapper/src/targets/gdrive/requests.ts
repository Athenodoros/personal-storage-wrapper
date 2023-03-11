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
        if (connection.expiry < new Date()) {
            onRefreshNeeded();
            return Result.error<T>();
        }

        const result = await fetch(input, init);

        if (result.status === 401) {
            onRefreshNeeded();
            return Result.error<T>();
        }

        const json = await result.json();
        resolve(json);
    });
