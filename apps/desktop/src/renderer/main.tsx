import "@weft/app/styles.css";

import { App, ThemeProvider } from "@weft/app";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { connectWeft } from "../ipc/connect.ts";
import type { WeftBridge } from "../ipc/protocol.ts";

declare global {
  interface Window {
    /** Set by the preload. */
    readonly weftBridge?: WeftBridge;
  }
}

const root = document.getElementById("root");
if (!root) throw new Error("index.html has no #root.");
if (!window.weftBridge) throw new Error("The preload did not expose Weft.");

const weft = connectWeft(window.weftBridge);

createRoot(root).render(
  <StrictMode>
    <ThemeProvider>
      <App weft={weft} />
    </ThemeProvider>
  </StrictMode>,
);
