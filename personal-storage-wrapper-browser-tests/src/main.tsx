import * as PSW from "personal-storage-wrapper";
import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import "./index.css";

(window as any).PSW = PSW;

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);
