import { expect, test } from "bun:test";
import { makeId, type EntryListItem, type Instant } from "@weft/contracts";

import { bodySaves, panelTitle } from "./entry-panel.tsx";

const entry: EntryListItem = {
  entryId: makeId<"entry">(0, () => new Uint8Array(10)),
  body: "Book the checkup",
  writtenAt: new Date(2026, 10, 8, 12).toISOString() as Instant,
  parentEntryId: null,
  putAway: false,
  followUpDate: null,
  completed: null,
  threadIds: [],
};

test("the panel's title says what it holds, when it was written, and whether it is put away", () => {
  expect(panelTitle(entry)).toBe("Entry · Nov 8");
  expect(panelTitle({ ...entry, putAway: true })).toBe(
    "Entry · Nov 8 · put away",
  );
  expect(panelTitle({ ...entry, parentEntryId: entry.entryId })).toBe(
    "Update · Nov 8",
  );
});

test("a body is sent once, and a save's answer never replaces what was typed after it", () => {
  const saves = bodySaves();
  expect(saves.send("Desk chair", "Desk chair?")).toBe(true);
  expect(saves.send("Desk chair", "Desk chair?")).toBe(false);
  expect(saves.send("Desk chair, the grey one", "Desk chair?")).toBe(true);
  expect(saves.read("Desk chair", "Desk chair, the grey one!")).toBe(false);
  expect(
    saves.read("Desk chair, the grey one", "Desk chair, the grey one!"),
  ).toBe(false);
  expect(saves.send("Grey chair", "Desk chair, the grey one")).toBe(true);
  expect(saves.read("Grey chair", "Grey chair ")).toBe(true);
  expect(saves.read("Chair", "Grey chair")).toBe(true);
});

test("a failed save is sent again", () => {
  const saves = bodySaves();
  expect(saves.send("Chair", "Desk chair?")).toBe(true);
  saves.failed("Chair");
  expect(saves.send("Chair", "Desk chair?")).toBe(true);
});
