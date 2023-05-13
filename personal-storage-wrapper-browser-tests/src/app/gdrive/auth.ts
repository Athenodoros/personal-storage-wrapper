import { GDriveTarget } from "personal-storage-wrapper";
import { getConnectInPopup } from "../utils/auth";
import { TestConfig } from "../utils/tests";

const CLIENT_ID = "151346048888-a4i2hah9aqh8bm4058muuau52sfcp0ge.apps.googleusercontent.com";
const POPUP_URL = window.location.origin + "/gdrive-popup";
// const REDIRECT_URL = window.location.origin + "/gdrive-redirect";

const ConnectInPopup: TestConfig<GDriveTarget> = getConnectInPopup(() =>
    GDriveTarget.setupInPopup(CLIENT_ID, POPUP_URL, { name: "/data.bak" })
);

export const GDriveAuthTests: TestConfig<GDriveTarget>[] = [ConnectInPopup];
