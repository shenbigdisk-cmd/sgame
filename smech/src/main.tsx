import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/orbitron/latin-400.css";
import "@fontsource/orbitron/latin-500.css";
import "@fontsource/orbitron/latin-700.css";
import "@fontsource/orbitron/latin-900.css";
import "@fontsource/share-tech-mono/latin-400.css";
import "./index.css";
import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";

const container = document.getElementById("root");
if (!container) {
  throw new Error("Steel Horizon could not find its root element.");
}

createRoot(container).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
