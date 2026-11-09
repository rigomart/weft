import type { Command, EntryId, FollowUpDate, Weft } from "@weft/contracts";

import { newId, type NewId } from "./new-id.ts";

interface Commands {
  readonly write: Extract<Command, { type: "write entry" }>;
  readonly setFollowUpDate: Extract<
    Command,
    { type: "set follow-up date" }
  > | null;
}

/**
 * Writes an Entry from what was typed in the capture box, then sets its Follow-up date when it has
 * one. Until a capture goes through, capturing the same text sends the same "write entry" again,
 * with the same IDs, so a retry after a failure whose outcome is unknown never stores the Entry
 * twice (ADR 0010). The same goes for its date, and a date changed before the retry is set on that
 * same Entry. Resolves to the Entry's ID, or null when there is nothing to write.
 */
export function createCapture(weft: Weft, makeNewId: NewId = newId) {
  let pending: Commands | undefined;
  return async function capture(
    text: string,
    followUpDate: FollowUpDate | null = null,
    /** Set to write an Update to that Entry. */
    parentEntryId: EntryId | null = null,
  ): Promise<EntryId | null> {
    const body = text.trim();
    if (!body) return null;
    if (
      pending?.write.body !== body ||
      pending.write.parentEntryId !== parentEntryId
    ) {
      const entryId = makeNewId("entry");
      pending = {
        write: {
          type: "write entry",
          eventId: makeNewId("event"),
          entryId,
          body,
          parentEntryId,
        },
        setFollowUpDate: null,
      };
    }
    if (
      !sameFollowUpDate(pending.setFollowUpDate?.followUpDate, followUpDate)
    ) {
      pending = {
        write: pending.write,
        setFollowUpDate: followUpDate && {
          type: "set follow-up date",
          eventId: makeNewId("event"),
          entryId: pending.write.entryId,
          followUpDate,
        },
      };
    }
    const commands = pending;
    await weft.run(commands.write);
    if (commands.setFollowUpDate) await weft.run(commands.setFollowUpDate);
    if (pending === commands) pending = undefined;
    return commands.write.entryId;
  };
}

function sameFollowUpDate(
  a: FollowUpDate | null | undefined,
  b: FollowUpDate | null,
) {
  return JSON.stringify(a ?? null) === JSON.stringify(b);
}
