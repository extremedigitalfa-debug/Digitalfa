import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, HashRouter } from "react-router-dom";
import { AuthProvider } from "./auth.jsx";
import App from "./App.jsx";
import "./styles.css";

// The standalone demo build (opened as a local file://) needs HashRouter,
// since BrowserRouter's pushState paths break without a server.
const Router = import.meta.env && import.meta.env.VITE_DEMO ? HashRouter : BrowserRouter;

function mount() {
  ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
      <Router>
        <AuthProvider>
          <App />
        </AuthProvider>
      </Router>
    </React.StrictMode>
  );
}
// Mount after the DOM is ready — robust whether the bundle is a deferred module
// or a classic inline script placed in <head>.
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
else mount();
