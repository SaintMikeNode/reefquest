import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { ErrorBoundary } from "./ui/ErrorBoundary";
import { Curtain } from "./ui/SceneTransition";
import "./styles.css";

// A page that was opened before a new version went live asks for script files that no longer
// exist (every build names its files anew), and the server answers with the home page instead. The
// page being opened then fails to load and the visitor lands on the error card. Vite reports that
// failure as `vite:preloadError`: reload once to pick up the new version. If it fails again within
// half a minute the cause is something else, so the error card is left to show.
window.addEventListener("vite:preloadError", (e) => {
  const KEY = "rq-reloaded-at";
  try {
    if (Date.now() - Number(sessionStorage.getItem(KEY) || 0) < 30_000) return;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    return; // no session storage: can't guard against a reload loop, so don't reload
  }
  e.preventDefault();
  location.reload();
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
      <Curtain />
    </ErrorBoundary>
  </StrictMode>,
);
