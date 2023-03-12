import {
    constructURLWithQueryParams,
    getFromPopup,
    loadFromSessionStorage,
    MAX_RTT_FOR_QUERY_IN_SECONDS,
    saveToSessionStorage,
} from "../utils";
import { GDriveConnection } from "./types";

const getAuthRedirectURL = (clientId: string, useAppData: boolean, redirectURI: string, scopes?: string[]) => {
    const uri = encodeURI(redirectURI);

    const defaultScope = useAppData
        ? "https://www.googleapis.com/auth/drive.appdata"
        : "https://www.googleapis.com/auth/drive.file";
    const definitelyScopes = scopes
        ? scopes.includes(defaultScope)
            ? scopes
            : scopes.concat([defaultScope])
        : [defaultScope];
    const scope = encodeURI(definitelyScopes.join(" "));

    return constructURLWithQueryParams("https://accounts.google.com/o/oauth2/v2/auth", {
        client_id: clientId,
        redirect_uri: uri,
        response_type: "token",
        scope,
    });
};

const SESSION_STORAGE_KEY = "PERSONAL_STORAGE_WRAPPER_GDRIVE_CHALLENGE";
interface SessionStorageStruct {
    clientId: string;
    redirectURI: string;
    useAppData: boolean;
}

export const redirectForAuth = async (
    clientId: string,
    useAppData: boolean,
    redirectURI?: string,
    scopes?: string[]
): Promise<void> => {
    const definitelyRedirectURI = redirectURI || window.location.href.split("?")[0].split("#")[0];
    saveToSessionStorage<SessionStorageStruct>(SESSION_STORAGE_KEY, {
        clientId,
        useAppData,
        redirectURI: definitelyRedirectURI,
    });
    window.location.href = getAuthRedirectURL(clientId, useAppData, definitelyRedirectURI, scopes);
};

export const catchRedirectForAuth = async (): Promise<GDriveConnection | null> => {
    const session = loadFromSessionStorage<SessionStorageStruct>(SESSION_STORAGE_KEY);
    if (session === null) return null;

    const { clientId, useAppData, redirectURI } = session;
    if (window.location.href.split("#")[0] !== redirectURI) return null;

    const search = new URLSearchParams(window.location.hash.replace("#", ""));
    const accessToken = search.get("access_token");
    const expiresIn = search.get("expires_in");

    if (!accessToken || !expiresIn) return null;
    const expiry = new Date(new Date().valueOf() + (Number(expiresIn) - MAX_RTT_FOR_QUERY_IN_SECONDS * 2) * 1000);

    // Return metadata
    return { clientId, useAppData, accessToken, expiry };
};

export const runAuthInPopup = async (
    clientId: string,
    useAppData: boolean,
    redirectURI?: string,
    scopes?: string[]
): Promise<GDriveConnection | null> => {
    const definitelyRedirectURI = redirectURI || window.location.href.split("?")[0].split("#")[0];

    // Open separate window for auth
    const startDate = new Date();
    const url = getAuthRedirectURL(clientId, useAppData, definitelyRedirectURI, scopes);

    // Wait for redirect after authing in to GDrive
    const results = await getFromPopup({ url }, (context) => {
        if (context.location.href.split("#")[0] !== definitelyRedirectURI) return null;

        const search = new URLSearchParams(context.location.hash.replace("#", ""));
        const accessToken = search.get("access_token");
        const expiresIn = search.get("expires_in");

        return accessToken && expiresIn
            ? {
                  accessToken,
                  expiry: new Date(startDate.valueOf() + (Number(expiresIn) - MAX_RTT_FOR_QUERY_IN_SECONDS) * 1000),
              }
            : null;
    });
    if (!results) return null;
    const { accessToken, expiry } = results;

    // Return metadata
    return { clientId, useAppData, accessToken, expiry };
};
