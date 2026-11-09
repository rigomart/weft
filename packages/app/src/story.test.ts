import { expect, test } from "bun:test";
import {
  calendarDay,
  makeId,
  timeOfDay,
  type EntryId,
  type EntryListItem,
  type Instant,
  type ThreadId,
} from "@weft/contracts";

import { firstEntryOf, storyOf, threadStory } from "./story.ts";

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

test("a Thread's story splits at today: what happened in time order, then what is coming", () => {
  const teeth = makeId<"thread">(1, () => new Uint8Array(10)) as ThreadId;
  const sleep = makeId<"thread">(2, () => new Uint8Array(10)) as ThreadId;
  const on = (e: EntryListItem, ...threadIds: ThreadId[]) => ({
    ...e,
    threadIds,
  });
  const dated = (e: EntryListItem, day: string) => ({
    ...e,
    followUpDate: { day: calendarDay(day), time: null, repeat: null },
  });
  const dentist = on(entry("Dentist: grinding teeth"), teeth, sleep);
  const ordered = on(entry("Ordered the night guard", dentist), teeth, sleep);
  const fitted = dated(
    on(entry("Get it fitted", dentist), teeth, sleep),
    "2026-11-20",
  );
  const late = dated(on(entry("Call the lab"), teeth), "2026-11-01");
  const elsewhere = on(entry("Awake at 4am"), sleep);
  const story = threadStory(
    teeth,
    [elsewhere, late, fitted, ordered, dentist],
    calendarDay("2026-11-08"),
  );
  expect(story.happened.map((e) => e.body)).toEqual([
    "Call the lab",
    "Dentist: grinding teeth",
    "Ordered the night guard",
  ]);
  expect(story.coming.map((e) => e.body)).toEqual(["Get it fitted"]);
});

test("a Thread's story orders by this device's calendar and clock, a timed Follow-up date at its time", () => {
  const teeth = makeId<"thread">(3, () => new Uint8Array(10)) as ThreadId;
  const at = (
    date: Date,
    body: string,
    followUp?: [string, string | null],
  ) => ({
    ...entry(body),
    writtenAt: date.toISOString() as Instant,
    threadIds: [teeth],
    followUpDate: followUp
      ? {
          day: calendarDay(followUp[0]),
          time: followUp[1] === null ? null : timeOfDay(followUp[1]),
          repeat: null,
        }
      : null,
  });
  const lateNight = at(
    new Date(2026, 10, 6, 23, 30),
    "Written late on the 6th",
  );
  const evening = at(new Date(2026, 10, 1), "Call at 17:00", [
    "2026-11-07",
    "17:00",
  ]);
  const morning = at(new Date(2026, 10, 2), "Call at 9:00", [
    "2026-11-07",
    "09:00",
  ]);
  const allDay = at(new Date(2026, 10, 3), "Any time on the 7th", [
    "2026-11-07",
    null,
  ]);
  expect(
    threadStory(
      teeth,
      [allDay, morning, evening, lateNight],
      calendarDay("2026-11-08"),
    ).happened.map((e) => e.body),
  ).toEqual([
    "Written late on the 6th",
    "Any time on the 7th",
    "Call at 9:00",
    "Call at 17:00",
  ]);
});
