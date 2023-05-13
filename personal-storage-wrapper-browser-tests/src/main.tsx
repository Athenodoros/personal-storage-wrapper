import * as PSW from "personal-storage-wrapper";
import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./app";
import "./index.css";

(window as any).PSW = PSW;

const Loading = () => (
    <div className="h-screen w-screen flex items-center bg-slate-200 justify-center">
        <div className="scale-[3]">
            <span className="material-icons animate-spin text-slate-600">autorenew</span>
        </div>
    </div>
);

const render = (element: React.ReactNode) => {
    ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
        <React.StrictMode>{element}</React.StrictMode>
    );
};

if (window.location.pathname.startsWith("/dropbox-popup")) {
    render(<Loading />);
} else if (window.location.pathname.startsWith("/gdrive-popup")) {
    render(<Loading />);
} else {
    render(<App />);
}
