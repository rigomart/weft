import {
  readQueryResult,
  readTablesChanged,
  readWeftError,
  type TablesChanged,
  type Weft,
} from "@weft/contracts";

import type { Call, WeftBridge } from "./protocol.ts";

/** Weft failed in a way that is not a refusal, such as the database failing. */
export class WeftFailure extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WeftFailure";
  }
}

/**
 * The window's side of the bridge: the contract over IPC to main. Every reply and notification is
 * read with the contract's readers before it is used. A refusal rejects with the same `WeftError`
 * main gave; any other failure rejects with a `WeftFailure`.
 */
export function connectWeft(
  bridge: WeftBridge,
  reportDropped: (error: unknown) => void = console.error,
): Weft {
  async function call(name: Call, message: unknown): Promise<unknown> {
    const reply = (await bridge.call(name, message)) as Record<
      string,
      unknown
    > | null;
    if (reply?.ok === true && "value" in reply) return reply.value;
    if (reply?.ok === false && "refusal" in reply) {
      throw readWeftError(reply.refusal);
    }
    if (reply?.ok === false && typeof reply.failure === "string") {
      throw new WeftFailure(reply.failure);
    }
    throw new WeftFailure(`Weft gave a reply that does not fit the bridge.`);
  }

  const listeners = new Set<(change: TablesChanged) => void>();
  let stopListening: (() => void) | undefined;

  return {
    async run(command) {
      await call("run", command);
    },
    async read(query) {
      return readQueryResult(query, await call("read", query));
    },
    subscribe(listener) {
      const subscription = (change: TablesChanged) => listener(change);
      listeners.add(subscription);
      stopListening ??= bridge.onChanged((message) => {
        let change: TablesChanged;
        try {
          change = readTablesChanged(message);
        } catch (error) {
          reportDropped(error);
          return;
        }
        for (const each of listeners) {
          try {
            each(change);
          } catch (error) {
            reportDropped(error);
          }
        }
      });
      return () => {
        listeners.delete(subscription);
        if (listeners.size === 0) {
          stopListening?.();
          stopListening = undefined;
        }
      };
    },
  };
}
