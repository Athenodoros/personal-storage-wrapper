import * as PSW from "personal-storage-wrapper";
import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./application";
import "./index.css";

console.info(
    "Welcome! To experiment here in the console, you can use window.manager for the instantiated example manager and window.PSW to access the full personal-storage-manager package"
);
(window as any).PSW = PSW;

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);
