import { Result } from "../result";
import { constructURLWithQueryParams, getFromPopup, loadFromSessionStorage, saveToSessionStorage } from "../utils";
import { getDropboxErrorDetail, runDropboxQueryForJSON } from "./requests";
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

/**
 * Exchanges an authorisation code for a connection. Dropbox answers a code it won't take - expired,
 * used already, or for another redirect URI - with an error rather than tokens, and that is reported
 * with Dropbox's own description of it, rather than as a connection whose tokens are `undefined`.
 */
const getConnectionForAuthCode = (
    clientId: string,
    redirectURI: string,
    verifier: string,
    code: string
): Result<DropboxConnection> =>
    new Result(async (resolve) => {
        const expiry = new Date();
        const response = await fetch(
            constructURLWithQueryParams("https://api.dropboxapi.com/oauth2/token", {
                grant_type: "authorization_code",
                client_id: clientId,
                redirect_uri: redirectURI,
                code_verifier: verifier,
                code,
            }),
            { method: "POST" }
        );
        const access = await response.json().catch(() => ({}));

        if (
            typeof access?.access_token !== "string" ||
            typeof access?.refresh_token !== "string" ||
            typeof access?.expires_in !== "number"
        )
            return resolve({
                type: "error",
                error: access?.error === "invalid_grant" ? "INVALID_AUTH" : "UNKNOWN",
                detail:
                    getDropboxErrorDetail(access ?? {}) ?? `Dropbox did not sign in the account (${response.status})`,
            });

        expiry.setSeconds(expiry.getSeconds() + access.expires_in);
        resolve({
            type: "value",
            value: { clientId, refreshToken: access.refresh_token, accessToken: access.access_token, expiry },
        });
    });

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

/** A connection from the redirect back from Dropbox, or null if this page load isn't one */
export const catchRedirectForAuth = (): Result<DropboxConnection | null> =>
    new Result(async (resolve) => {
        const session = loadFromSessionStorage<SessionStorageStruct>(SESSION_STORAGE_KEY);
        if (session === null) return resolve({ type: "value", value: null });

        const { verifier, redirectURI, clientId } = session;
        if (window.location.href.split("?")[0] !== redirectURI) return resolve({ type: "value", value: null });

        const code = new URLSearchParams(window.location.search).get("code");
        if (!code) return resolve({ type: "value", value: null });

        resolve(await getConnectionForAuthCode(clientId, redirectURI, verifier, code));
    });

/**
 * A connection from signing in in a popup, or null if the user didn't: the popup was blocked or
 * closed, or came back without a code because the user turned the app down. Anything that goes wrong
 * once Dropbox has given a code is an error, so that it can be told apart from the user changing their mind.
 */
export const runAuthInPopup = (clientId: string, redirectURI?: string): Result<DropboxConnection | null> =>
    new Result(async (resolve) => {
        const definiteRedirectURI = redirectURI || window.location.href.split("?")[0];

        // Open separate window for auth
        const { url, verifier } = await getAuthRedirectDetails(clientId, definiteRedirectURI);
        const code = await getFromPopup({ url, height: 800, width: 680 }, (context) => {
            if (context.location.href.split("?")[0] !== definiteRedirectURI) return null;
            return new URLSearchParams(context.location.search).get("code");
        });
        if (!code) return resolve({ type: "value", value: null });

        resolve(await getConnectionForAuthCode(clientId, definiteRedirectURI, verifier, code));
    });

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
