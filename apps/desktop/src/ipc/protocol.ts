import type { WeftErrorMessage } from "@weft/contracts";

/*
 * How the window reaches Weft in the main process (ADR 0010). The preload exposes a `WeftBridge`;
 * main answers each call with a `Reply`. Neither side imports Electron here, so the contract suite
 * runs over both halves joined by a fake channel.
 */

export const CHANNELS = {
  run: "weft:run",
  read: "weft:read",
  changed: "weft:changed",
} as const;

export type Call = "run" | "read";

/** What the preload exposes to the window, as `window.weftBridge`. */
export interface WeftBridge {
  call(call: Call, message: unknown): Promise<unknown>;
  /** Calls `listener` with each change notification main sends. Returns a function that stops it. */
  onChanged(listener: (message: unknown) => void): () => void;
}

/**
 * Main's answer to a call. A refusal is a `WeftError` as data. A failure is anything else that went
 * wrong (the database, a bug), which the contract has no code for yet.
 */
export type Reply =
  | { readonly ok: true; readonly value: unknown }
  | { readonly ok: false; readonly refusal: WeftErrorMessage }
  | { readonly ok: false; readonly failure: string };
