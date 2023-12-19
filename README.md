# personal-storage-wrapper

Personal Storage Wrapper is a JS library which allows web apps to sync data with user-controlled storage like IndexedDB, Dropbox or GDrive. An example to-do application is hosted [here](https://athenodoros.github.io/personal-storage-wrapper/) (code [here](https://github.com/Athenodoros/personal-storage-wrapper/blob/main/personal-storage-wrapper-example/src/application/index.tsx)).

#### API Usage

```
// Initialise manager with some default state, using the default IndexedDB sync, gzip compression, and conflict handlers
const manager = await PersonalStorageManager.create(SOME_DEFAULT_STATE, { onValueUpdate: console.log });

// Add a dropbox setup flow to a button, with auth run through a popup window
DropboxSetupButton.onclick = () => {
    const dropbox: DropboxTarget | null = await DropboxTarget.setupInPopup(DROPBOX_CLIENT_ID, DROPBOX_REDIRECT_URI);
    if (dropbox) manager.addTarget(dropbox);
}

// Write new value and sync to targets
manager.setState(SOME_NEW_VALUE);
```

#### Why does this exist?

This project was inspired by [a previous one](https://github.com/Athenodoros/TopHat), an in-browser app without a backend (both for privacy and simplicity). With that in mind, PSW is intended as a lightweight but full-featured solution for managing state synchronisation between local and cloud storage. It includes:
- A standard and extendable sync target interface
- Local (IndexedDB and memory) and remote (Dropbox and GDrive, for now) sync targets
- Background polling for remote updates
- A [load of config points](https://github.com/Athenodoros/personal-storage-wrapper/blob/main/personal-storage-wrapper/src/manager/types/config.ts), including pluggable conflict resolution handlers
- Automatic syncing between tabs

All bundled into 13kb of gzipped JS with only one dependency: [fflate](https://www.npmjs.com/package/fflate), lazily loaded in case the storage is compressed the CompressionStream browser API is not available ([mostly older safari](https://caniuse.com/?search=compressionstream)).

#### Can I use this?

You can, but probably shouldn't? I haven't uploaded it to npm because I'm scared of the maintenance obligation I'd impose on myself, but if you'd like then you're welcome to use the code :D
