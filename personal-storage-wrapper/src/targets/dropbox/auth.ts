import { Result } from "../result";
import { constructURLWithQueryParams, getFromPopup, loadFromSessionStorage, saveToSessionStorage } from "../utils";
import { runDropboxQueryForJSON } from "./requests";
import { DropboxConnection, DropboxUserDetails } from "./types";

// The dropbox API uses an alternate base64 encoding to stop URL encoding issues
// See also: https://github.com/dropbox/dropbox-sdk-js/blob/main/src/utils.js#L64
const base64Encode = (array: Uint8Array): string =>
    btoa(String.fromCharCode(...(array as unknown as number[])))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, "");

// Gets a random string of length 86 (64 * 8 bits / log2(64 characters))
const getCodeVerifier = (): string => {
    const array = new Uint8Array(64);
    crypto.getRandomValues(array);
    return base64Encode(array);
};

// https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest#basic_example
const sha256Hash = async (challenge: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(challenge);
    const hash = await crypto.subtle.digest("SHA-256", data);
    return base64Encode(new Uint8Array(hash));
};

const SESSION_STORAGE_KEY = "PERSONAL_STORAGE_WRAPPER_DROPBOX_CHALLENGE";
interface SessionStorageStruct {
    verifier: string;
    clientId: string;
    redirectURI: string;
}

const getAuthRedirectDetails = async (clientId: string, redirectURI: string) => {
    const verifier = getCodeVerifier();
    const challenge = await sha256Hash(verifier);

    return {
        verifier,
        url: constructURLWithQueryParams("https://dropbox.com/oauth2/authorize", {
            response_type: "code",
            client_id: clientId,
            redirect_uri: redirectURI,
            token_access_type: "offline",
            code_challenge_method: "S256",
            code_challenge: challenge,
        }),
    };
};

const getAccessTokenForAuthCode = (client_id: string, redirect_uri: string, code_verifier: string, code: string) =>
    fetch(
        constructURLWithQueryParams("https://api.dropboxapi.com/oauth2/token", {
            grant_type: "authorization_code",
            client_id,
            redirect_uri,
            code_verifier,
            code,
        }),
        { method: "POST" }
    ).then(
        (response) => response.json() as Promise<{ expires_in: number; refresh_token: string; access_token: string }>
    );

export const redirectForAuth = async (clientId: string, redirectURI?: string): Promise<void> => {
    const definiteRedirectURI = redirectURI || window.location.href.split("?")[0];
    const { url, verifier } = await getAuthRedirectDetails(clientId, definiteRedirectURI);
    saveToSessionStorage<SessionStorageStruct>(SESSION_STORAGE_KEY, {
        verifier,
        clientId,
        redirectURI: definiteRedirectURI,
    });
    window.location.href = url;
};

export const catchRedirectForAuth = async (): Promise<DropboxConnection | null> => {
    const session = loadFromSessionStorage<SessionStorageStruct>(SESSION_STORAGE_KEY);
    if (session === null) return null;

    const { verifier, redirectURI, clientId } = session;
    if (window.location.href.split("?")[0] !== redirectURI) return null;

    const code = new URLSearchParams(window.location.search).get("code");
    if (!code) return null;

    window.history.replaceState(null, "", redirectURI);

    const expiry = new Date();
    const access = await getAccessTokenForAuthCode(
        clientId,
        redirectURI ?? window.location.href.split("?")[0],
        verifier,
        code
    );
    expiry.setSeconds(expiry.getSeconds() + access.expires_in);

    return { clientId, refreshToken: access.refresh_token, accessToken: access.access_token, expiry };
};

export const runAuthInPopup = async (clientId: string, redirectURI?: string): Promise<DropboxConnection | null> => {
    const definiteRedirectURI = redirectURI || window.location.href.split("?")[0];

    // Open separate window for auth
    const { url, verifier } = await getAuthRedirectDetails(clientId, definiteRedirectURI);
    const code = await getFromPopup({ url }, (context) => {
        if (context.location.href.split("?")[0] !== redirectURI) return null;
        return new URLSearchParams(context.location.search).get("code");
    });
    if (!code) return null;

    // Get access token
    const expiry = new Date();
    const access = await getAccessTokenForAuthCode(clientId, definiteRedirectURI, verifier, code);
    expiry.setSeconds(expiry.getSeconds() + access.expires_in);

    // Return final result
    return {
        clientId,
        refreshToken: access.refresh_token,
        accessToken: access.access_token,
        expiry,
    };
};

interface DropboxUserMetadata {
    account_id: string;
    email: string;
    name: {
        abbreviated_name: string;
        display_name: string;
        familiar_name: string;
        given_name: string;
        surname: string;
    };
}

export const getUserMetadata = (connection: DropboxConnection): Result<DropboxUserDetails> =>
    runDropboxQueryForJSON<DropboxUserMetadata>(connection, "https://api.dropboxapi.com/2/users/get_current_account", {
        method: "POST",
    }).map((user) => ({ id: user.account_id, name: user.name.display_name, email: user.email }));
