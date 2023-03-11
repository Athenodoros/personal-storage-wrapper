import { constructURLWithQueryParams, MAX_RTT_FOR_QUERY_IN_SECONDS } from "../utils";
import { GDriveConnection } from "./types";

const getRedirectURL = (maybeRedirectURI?: string) =>
    maybeRedirectURI || window.location.href.split("?")[0].split("#")[0];

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

export const redirectForAuth = async (
    clientId: string,
    useAppData: boolean,
    redirectURI?: string,
    scopes?: string[]
): Promise<void> => {
    window.location.href = getAuthRedirectURL(clientId, useAppData, getRedirectURL(redirectURI), scopes);
};

export const catchRedirectForAuth = async (
    clientId: string,
    useAppData: boolean,
    redirectURI?: string
): Promise<GDriveConnection | null> => {
    if (redirectURI && window.location.href.split("#")[0] !== redirectURI) return Promise.resolve(null);

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
    const definitelyRedirectURI = getRedirectURL(redirectURI);

    // Open separate window for auth
    const startDate = new Date();
    const url = getAuthRedirectURL(clientId, useAppData, definitelyRedirectURI, scopes);
    const context = window.open(url, "_blank", "toolbar=false,menubar=false,height=600,width=480");
    if (context === null) return Promise.resolve(null);

    // Wait for redirect after authing in to GDrive
    const results = await new Promise<{ accessToken: string; expiry: Date } | null>((resolve) => {
        context.onload = () => {
            if (context.location.href.split("#")[0] !== definitelyRedirectURI) return resolve(null);

            const search = new URLSearchParams(context.location.hash.replace("#", ""));
            const accessToken = search.get("access_token");
            const expiresIn = search.get("expires_in");

            if (!accessToken || !expiresIn) resolve(null);
            else
                resolve({
                    accessToken,
                    expiry: new Date(startDate.valueOf() + (Number(expiresIn) - MAX_RTT_FOR_QUERY_IN_SECONDS) * 1000),
                });

            context.close();
        };
    });
    if (!results) return null;
    const { accessToken, expiry } = results;

    // Return metadata
    return { clientId, useAppData, accessToken, expiry };
};
