export const DropboxTargetType = "dropbox" as const;
export type DropboxTargetType = typeof DropboxTargetType;

export interface DropboxConnection {
    clientId: string;
    refreshToken: string;
    accessToken: string;
    expiry: Date;
}

export interface DropboxUserDetails {
    id: string;
    email: string;
    name: string;
}

export type DropboxTargetSerialisationConfig = {
    path: string;
    connection: Omit<DropboxConnection, "expiry"> & { expiry: string };
    user: DropboxUserDetails;
};
