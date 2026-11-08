import {
  readCommand,
  readQuery,
  toWeftErrorMessage,
  WeftError,
  type TablesChanged,
  type Weft,
} from "@weft/contracts";

import type { Call, Reply } from "./protocol.ts";

/**
 * Main's side of the bridge: answers each call from the window with a `Reply`, and never rejects.
 * Every message from the window is read with the contract's readers before Weft sees it.
 * `reportFailure` hears each failure that is not a refusal.
 */
export function serveWeft(
  weft: Weft,
  reportFailure: (call: Call, error: unknown) => void,
): Record<Call, (message: unknown) => Promise<Reply>> {
  async function answer(
    call: Call,
    work: () => Promise<unknown>,
  ): Promise<Reply> {
    try {
      return { ok: true, value: await work() };
    } catch (error) {
      if (error instanceof WeftError) {
        return { ok: false, refusal: toWeftErrorMessage(error) };
      }
      reportFailure(call, error);
      return {
        ok: false,
        failure: error instanceof Error ? error.message : String(error),
      };
    }
  }
  return {
    run: (message) =>
      answer("run", async () => {
        await weft.run(readCommand(message));
        return null;
      }),
    read: (message) => answer("read", () => weft.read(readQuery(message))),
  };
}

/**
 * Sends each change notification to the window while it is open. `send` is called only while
 * `target` gives one, and the listener never throws: Weft calls it from inside a command, and an
 * error there would surface as an unhandled rejection in main. Returns a function that stops it.
 */
export function forwardChanges(
  weft: Weft,
  target: () => { send(change: TablesChanged): void } | undefined,
  reportFailure: (error: unknown) => void,
): () => void {
  return weft.subscribe((change) => {
    try {
      target()?.send(change);
    } catch (error) {
      reportFailure(error);
    }
  });
}
