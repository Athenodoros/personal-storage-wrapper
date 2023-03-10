export const GDriveTargetType = "gdrive" as const;
export type GDriveTargetType = typeof GDriveTargetType;

export interface GDriveConnection {
    clientId: string;
    useAppData: boolean;
    accessToken: string;
    expiry: Date;
}

export interface GDriveUserDetails {
    id: string;
    email: string;
    name: string;
}

export type GDriveTargetSerialisationConfig = {
    file: string;
    connection: GDriveConnection;
    user: GDriveUserDetails;
};
