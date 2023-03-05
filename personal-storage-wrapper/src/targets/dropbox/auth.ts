import { Result } from "../result";
import { constructURLWithQueryParams } from "../utils";
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

const getAuthRedirectURLAndSetChallengeState = async (clientId: string, redirectURI: string) => {
    const verifier = getCodeVerifier();
    const challenge = await sha256Hash(verifier);

    window.sessionStorage.clear();
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, verifier);

    return constructURLWithQueryParams("https://dropbox.com/oauth2/authorize", {
        response_type: "code",
        client_id: clientId,
        redirect_uri: redirectURI,
        token_access_type: "offline",
        code_challenge_method: "S256",
        code_challenge: challenge,
    });
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
    ).then((response) => response.json());

export const redirectForAuth = async (clientId: string, redirectURI?: string): Promise<void> => {
    const definiteRedirectURI = redirectURI || window.location.href.split("?")[0];
    window.location.href = await getAuthRedirectURLAndSetChallengeState(clientId, definiteRedirectURI);
};

export const catchRedirectForAuth = async (
    clientId: string,
    redirectURI?: string
): Promise<DropboxConnection | null> => {
    if (redirectURI && window.location.href.split("?")[0] !== redirectURI) return Promise.resolve(null);

    const code = new URLSearchParams(window.location.search).get("code");
    if (!code) return Promise.resolve(null);
    window.history.replaceState(null, "", redirectURI);

    const verifier = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!verifier) return Promise.resolve(null);

    const expiry = new Date();
    const access = await getAccessTokenForAuthCode(
        clientId,
        redirectURI ?? window.location.href.split("?")[0],
        verifier,
        code
    );
    expiry.setSeconds((expiry.getSeconds() + access.expires_in) as number);

    return { clientId, refreshToken: access.refresh_token, accessToken: access.access_token, expiry };
};

export const runAuthInPopup = async (clientId: string, redirectURI?: string): Promise<DropboxConnection | null> => {
    const definiteRedirectURI = redirectURI || window.location.href.split("?")[0];

    // Open separate window for auth
    const url = await getAuthRedirectURLAndSetChallengeState(clientId, definiteRedirectURI);
    const context = window.open(url, "_blank", "toolbar=false,menubar=false,height=600,width=480");
    if (context === null) return Promise.resolve(null);

    // Wait for redirect after authing in to Dropbox
    const code = await new Promise<string | null>((resolve) => {
        context.onload = () => {
            if (context.location.href.split("?")[0] !== redirectURI) return resolve(null);
            resolve(new URLSearchParams(context.location.search).get("code"));
            context.close();
        };
    });
    if (!code) return null;

    // Get access token
    const verifier = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!verifier) return Promise.resolve(null);

    const expiry = new Date();
    const access = await getAccessTokenForAuthCode(clientId, definiteRedirectURI, verifier, code);
    expiry.setSeconds((expiry.getSeconds() + access.expires_in) as number);

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
