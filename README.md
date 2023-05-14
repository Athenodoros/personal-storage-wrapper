# personal-storage-wrapper

Personal Storage Wrapper is a JS library to allow users of a web app to bring their own storage solution, instead of the app developer needing to maintain a backend.

This could be useful more multiple reasons: it's better for privacy and information security, it's easier to deploy applications, and it can transparently allow offline-first behaviour by including browser storage by default.

This project was inspired by [a previous one](https://github.com/Athenodoros/TopHat), where (for all of the reasons above) I didn't want a backend server for the application.
This package is intended as a lightweight but full-featured solution for managing that problem: it handles push and pull, local (IndexedDB) and remote (Dropbox/GDrive for now) sources, and pluggable conflict resolution where appropriate.

An example application built using this package can be found at: https://athenodoros.github.io/personal-storage-wrapper/.
