export const DropboxTargetType = "memory" as const;
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
    connection: DropboxConnection;
    user: DropboxUserDetails;
};
