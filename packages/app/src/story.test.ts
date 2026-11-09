import { expect, test } from "bun:test";
import {
  makeId,
  type EntryId,
  type EntryListItem,
  type Instant,
} from "@weft/contracts";

import { firstEntryOf, storyOf } from "./story.ts";

let ms = Date.UTC(2026, 10, 3);
function entry(
  body: string,
  parent: EntryListItem | null = null,
): EntryListItem {
  const at = (ms += 86_400_000);
  return {
    entryId: makeId<"entry">(at, () => new Uint8Array(10)) as EntryId,
    body,
    writtenAt: new Date(at).toISOString() as Instant,
    parentEntryId: parent?.entryId ?? null,
    putAway: false,
    followUpDate: null,
    completed: null,
    threadIds: [],
  };
}

test("a story starts at its first Entry and lists each Update under the one it follows", () => {
  const dentist = entry("Dentist: grinding teeth");
  const guard = entry("Get the night guard fitted", dentist);
  const ordered = entry("Ordered the night guard", guard);
  const called = entry("Called the dentist back", dentist);
  const loose = entry("Desk chair?");
  const entries = [loose, called, ordered, guard, dentist];

  expect(
    firstEntryOf(ordered, new Map(entries.map((e) => [e.entryId, e]))),
  ).toBe(dentist);
  expect(
    storyOf(ordered, entries).map(({ entry, depth }) => [entry.body, depth]),
  ).toEqual([
    ["Dentist: grinding teeth", 0],
    ["Get the night guard fitted", 1],
    ["Ordered the night guard", 1],
    ["Called the dentist back", 1],
  ]);
  expect(storyOf(loose, entries).map(({ entry }) => entry.body)).toEqual([
    "Desk chair?",
  ]);
});

test("a single line of Updates stays unindented", () => {
  const claim = entry("Call about the claim");
  const rejected = entry("Rejected, appeal by the 20th", claim);
  expect(
    storyOf(claim, [rejected, claim]).map(({ entry, depth }) => [
      entry.body,
      depth,
    ]),
  ).toEqual([
    ["Call about the claim", 0],
    ["Rejected, appeal by the 20th", 0],
  ]);
});
