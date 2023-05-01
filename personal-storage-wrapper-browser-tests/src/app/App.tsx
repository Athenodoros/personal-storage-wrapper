import { DropboxTarget, GDriveTarget } from "personal-storage-wrapper";
import {
    decodeFromArrayBuffer,
    encodeToArrayBuffer,
} from "../../../personal-storage-wrapper/src/utilities/buffers/encoding";
import { Buffer, Container, Division, Heading } from "./components";
import { useAccountState } from "./hooks";

const file = encodeToArrayBuffer("Hello, World!");

export function App() {
    const dropbox = useAccountState("dropbox", DropboxTarget.deserialise);
    const gdrive = useAccountState("gdrive", GDriveTarget.deserialise);

    return (
        <div className="h-screen w-screen flex flex-col items-center bg-slate-200 overflow-y-scroll">
            <Buffer />
            <div className="w-[800px]">
                <h1 className="text-4xl uppercase mb-12 text-slate-400 font-light text-center">PSM Test Page</h1>
                <Division
                    title="Dropbox"
                    cloud={true}
                    image="/dropbox.png"
                    accounts={dropbox.accounts.map(({ id, target }) => ({
                        subtitle: target.user.email,
                        title: id,
                        select: () => dropbox.set(target),
                        selected: target === dropbox.selected,
                        remove: () => dropbox.remove(target),
                    }))}
                >
                    <Heading title="Creation" />
                    <Container
                        title="Connect In Popup"
                        then={(target) => void (target && dropbox.add(target))}
                        run={() =>
                            DropboxTarget.setupInPopup(
                                "sha2xamq49ewlbo",
                                window.location.origin + "/dropbox-popup",
                                "/data.json.tgz"
                            )
                        }
                    />
                    <Container
                        title="Redirect for Auth"
                        run={() =>
                            DropboxTarget.redirectForAuth(
                                "sha2xamq49ewlbo",
                                window.location.origin + "/dropbox-redirect"
                            )
                        }
                    />
                    <Container
                        title="Catch Auth Redirect"
                        then={dropbox.add}
                        run={() => {
                            const promise = DropboxTarget.catchRedirectForAuth("/data.json.tgz");
                            window.history.replaceState(null, "", window.location.origin);
                            return promise;
                        }}
                    />
                    <Heading title="Target Usage" />
                    <Container title="Get Timestamp" run={dropbox.selected && dropbox.selected.timestamp} />
                    <Container
                        title="Pull File"
                        run={
                            dropbox.selected &&
                            (() =>
                                dropbox.selected?.read().map(
                                    (value) =>
                                        value && {
                                            timestamp: value.timestamp,
                                            value: decodeFromArrayBuffer(value.buffer),
                                        }
                                ))
                        }
                    />
                    <Container title="Write File" run={dropbox.selected && (() => dropbox.selected?.write(file))} />
                    <Container title="Delete File" run={dropbox.selected && (() => dropbox.selected?.delete())} />
                </Division>
                <Division
                    title="GDrive"
                    cloud={true}
                    image="/gdrive.png"
                    accounts={gdrive.accounts.map(({ id, target }) => ({
                        subtitle: target.user.email,
                        title: id,
                        select: () => gdrive.set(target),
                        selected: target === gdrive.selected,
                        remove: () => gdrive.remove(target),
                    }))}
                >
                    <Heading title="Creation" />
                    <Container
                        title="Connect In Popup"
                        then={(target) => void (target && gdrive.add(target))}
                        run={() =>
                            GDriveTarget.setupInPopup(
                                "151346048888-a4i2hah9aqh8bm4058muuau52sfcp0ge.apps.googleusercontent.com",
                                window.location.origin + "/gdrive-popup",
                                { name: "data.json" }
                            )
                        }
                    />
                    <Container
                        title="Redirect for Auth"
                        run={() =>
                            GDriveTarget.redirectForAuth(
                                "151346048888-a4i2hah9aqh8bm4058muuau52sfcp0ge.apps.googleusercontent.com",
                                window.location.origin + "/gdrive-redirect"
                            )
                        }
                    />
                    <Container
                        title="Catch Auth Redirect"
                        then={gdrive.add}
                        run={() => {
                            const promise = GDriveTarget.catchRedirectForAuth({ name: "/data.json" });
                            window.history.replaceState(null, "", window.location.origin);
                            return promise;
                        }}
                    />
                    <Heading title="Target Usage" />
                    <Container title="Refresh Auth In Popup" />
                    <Container title="Refresh Auth Via Redirect" />
                    <Container title="Get Timestamp" run={gdrive.selected && gdrive.selected.timestamp} />
                    <Container
                        title="Pull File"
                        run={
                            gdrive.selected &&
                            (() =>
                                gdrive.selected?.read().map(
                                    (value) =>
                                        value && {
                                            timestamp: value.timestamp,
                                            value: decodeFromArrayBuffer(value.buffer),
                                        }
                                ))
                        }
                    />
                    <Container title="Write File" run={gdrive.selected && (() => gdrive.selected?.write(file))} />
                    <Container title="Delete File" run={gdrive.selected && (() => gdrive.selected?.delete())} />
                </Division>
            </div>
            <Buffer />
        </div>
    );
}
