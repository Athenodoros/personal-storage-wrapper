export const GDriveTargetType = "gdrive" as const;
export type GDriveTargetType = typeof GDriveTargetType;

export interface GDriveConnection {
    clientId: string;
    useAppData: boolean;
    accessToken: string;
    scopes: string[];
    expiry: Date;
}

export interface GDriveUserDetails {
    email: string;
    name: string;
}

export interface GDriveFileReference {
    id: string;
    mime: string;
}

export interface GDriveTargetSerialisationConfig {
    file: GDriveFileReference;
    connection: Omit<GDriveConnection, "expiry"> & { expiry: string };
    user: GDriveUserDetails;
}
