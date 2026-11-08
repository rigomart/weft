import { makeId, type Command, type Weft } from "@weft/contracts";

type NewId = <Kind extends "event" | "entry">(
  kind: Kind,
) => ReturnType<typeof makeId<Kind>>;

const newId: NewId = () =>
  makeId(Date.now(), (length) =>
    crypto.getRandomValues(new Uint8Array(length)),
  );

/**
 * Writes an Entry from what was typed in the capture box. Until one goes through, capturing the same
 * text sends the same command again, with the same IDs, so a retry after a failure whose outcome is
 * unknown never stores the Entry twice (ADR 0010). Resolves to false when there is nothing to
 * write.
 */
export function createCapture(weft: Weft, makeNewId: NewId = newId) {
  let pending: Extract<Command, { type: "write entry" }> | undefined;
  return async function capture(text: string): Promise<boolean> {
    const body = text.trim();
    if (!body) return false;
    if (pending?.body !== body) {
      pending = {
        type: "write entry",
        eventId: makeNewId("event"),
        entryId: makeNewId("entry"),
        body,
        parentEntryId: null,
      };
    }
    const command = pending;
    await weft.run(command);
    if (pending === command) pending = undefined;
    return true;
  };
}
