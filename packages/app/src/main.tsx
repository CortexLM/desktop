import "./zod-jitless";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./kit/styles.css";
import App from "./App";
import { bridgeFetch } from "./api";

// Exposed for the E2E suite, which drives the engine through the same bridge as the UI.
if (window.cortex) (window as unknown as { __bridgeFetch: typeof fetch }).__bridgeFetch = bridgeFetch;

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
