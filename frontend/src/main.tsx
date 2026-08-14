import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";

import React from "react";
import ReactDOM from "react-dom/client";

import { App } from "./App";
import { LanguageProvider } from "./i18n/LanguageContext";
import "./styles/tokens.css";
import "./styles/base.css";
import { AdminView } from "./views/AdminView";

// Pas de routeur : ce SPA ne connaît qu'une seule route côté client hors
// des vues F2-F8 (§ADR 0008), donc un simple aiguillage sur le chemin
// suffit plutôt que d'ajouter une dépendance de routing pour ça seul.
const isAdmin = window.location.pathname === "/admin";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <LanguageProvider>{isAdmin ? <AdminView /> : <App />}</LanguageProvider>
  </React.StrictMode>,
);
