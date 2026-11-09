import type { Command, EntryId, FollowUpDate, Weft } from "@weft/contracts";

import { newId, type NewId } from "./new-id.ts";

/**
 * Until a completion goes through, completing the same Entry with the same date resends the same
 * command, so a retry after an unknown outcome completes it once (ADR 0010).
 */
export function createCompletion(weft: Weft, makeNewId: NewId = newId) {
  const pending = new Map<
    string,
    Extract<Command, { type: "complete follow-up date" }>
  >();
  return async function complete(
    entryId: EntryId,
    followUpDate: FollowUpDate,
  ): Promise<void> {
    const key = JSON.stringify([entryId, followUpDate]);
    let command = pending.get(key);
    if (!command) {
      command = {
        type: "complete follow-up date",
        eventId: makeNewId("event"),
        entryId,
      };
      pending.set(key, command);
    }
    await weft.run(command);
    pending.delete(key);
  };
}
