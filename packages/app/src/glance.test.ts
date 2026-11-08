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

import { glance, groupOf } from "./glance.ts";

const today = calendarDay("2026-11-08");
let ms = Date.UTC(2026, 10, 8);

function entry(
  body: string,
  options: {
    day?: string;
    time?: string;
    putAway?: boolean;
    parent?: EntryId;
    threadIds?: ThreadId[];
  } = {},
): EntryListItem {
  const at = ms++;
  return {
    entryId: makeId<"entry">(at, () => new Uint8Array(10)),
    body,
    writtenAt: new Date(at).toISOString() as Instant,
    parentEntryId: options.parent ?? null,
    putAway: options.putAway ?? false,
    followUpDate: options.day
      ? {
          day: calendarDay(options.day),
          time: options.time ? timeOfDay(options.time) : null,
          repeat: null,
        }
      : null,
    threadIds: options.threadIds ?? [],
  };
}

/** Newest first, as the "entries" read gives them. */
const newestFirst = (...entries: EntryListItem[]) => entries.reverse();

const bodies = (entries: readonly EntryListItem[]) =>
  entries.map((e) => e.body);

test("groups a Follow-up date by how far it is from today", () => {
  const group = (day: string) => groupOf(calendarDay(day), today);
  expect(group("2025-12-31")).toBe("Late");
  expect(group("2026-11-07")).toBe("Late");
  expect(group("2026-11-08")).toBe("Today");
  expect(group("2026-11-09")).toBe("Tomorrow");
  expect(group("2026-11-10")).toBe("This week");
  expect(group("2026-11-14")).toBe("This week");
  expect(group("2026-11-15")).toBe("Later");
});

test("lists each group that has Entries, in order, and the Loose Entries beside them", () => {
  const read = newestFirst(
    entry("Hiked, felt calm"),
    entry("Call about the claim", { day: "2026-11-07" }),
    entry("Dentist follow-up", { day: "2026-11-29" }),
    entry("Book the checkup", { day: "2026-11-08", time: "09:30" }),
    entry("Pick up the prints", { day: "2026-11-12" }),
    entry("Desk chair?"),
  );
  const { groups, loose } = glance(read, today);
  expect(groups.map((g) => [g.name, bodies(g.entries)])).toEqual([
    ["Late", ["Call about the claim"]],
    ["Today", ["Book the checkup"]],
    ["This week", ["Pick up the prints"]],
    ["Later", ["Dentist follow-up"]],
  ]);
  expect(bodies(loose)).toEqual(["Desk chair?", "Hiked, felt calm"]);
});

test("orders a group by day, then time with no time first, then when written", () => {
  const read = newestFirst(
    entry("Fri at 8", { day: "2026-11-13", time: "08:00" }),
    entry("Tue at 18", { day: "2026-11-10", time: "18:00" }),
    entry("Tue, first written", { day: "2026-11-10" }),
    entry("Tue at 7", { day: "2026-11-10", time: "07:00" }),
    entry("Tue, written next", { day: "2026-11-10" }),
  );
  expect(bodies(glance(read, today).groups[0]!.entries)).toEqual([
    "Tue, first written",
    "Tue, written next",
    "Tue at 7",
    "Tue at 18",
    "Fri at 8",
  ]);
});

test("Loose holds only top-level Entries on no Thread and with no Follow-up date", () => {
  const thread = makeId<"thread">(ms, () => new Uint8Array(10));
  const claim = entry("Insurance claim");
  const read = newestFirst(
    claim,
    entry("Called the insurer", { parent: claim.entryId }),
    entry("Physio receipt", { threadIds: [thread] }),
    entry("Desk chair?"),
  );
  expect(bodies(glance(read, today).loose)).toEqual([
    "Desk chair?",
    "Insurance claim",
  ]);
});

test("a put-away Entry, and an Update to one, shows nowhere", () => {
  const away = entry("Old idea", { putAway: true });
  const read = newestFirst(
    away,
    entry("Its follow-up", { parent: away.entryId, day: "2026-11-08" }),
    entry("Put away, dated", { putAway: true, day: "2026-11-08" }),
    entry("Kept", { day: "2026-11-08" }),
  );
  const { groups, loose } = glance(read, today);
  expect(groups.map((g) => [g.name, bodies(g.entries)])).toEqual([
    ["Today", ["Kept"]],
  ]);
  expect(loose).toEqual([]);
});
