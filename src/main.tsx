import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";

const BASE_URL = import.meta.env.BASE_URL ?? "/";

function restoreRedirect() {
  if (typeof window === "undefined") return;
  try {
    const storedPath = sessionStorage.getItem("spa-redirect:path");
    if (!storedPath) return;
    sessionStorage.removeItem("spa-redirect:path");
    const storedSearch = sessionStorage.getItem("spa-redirect:search") ?? "";
    const storedHash = sessionStorage.getItem("spa-redirect:hash") ?? "";
    sessionStorage.removeItem("spa-redirect:search");
    sessionStorage.removeItem("spa-redirect:hash");

    const base = BASE_URL.endsWith("/") ? BASE_URL.slice(0, -1) : BASE_URL;
    const path = storedPath.startsWith("/") ? storedPath : `/${storedPath}`;
    const target = `${base}${path}${storedSearch}${storedHash}` || "/";
    window.history.replaceState(null, "", target);
  } catch (error) {
    console.warn("Failed to restore SPA redirect", error);
  }
}

restoreRedirect();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
