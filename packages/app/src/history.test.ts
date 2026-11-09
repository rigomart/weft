import { expect, test } from "bun:test";
import {
  calendarDay,
  makeId,
  type EntryId,
  type EntryListItem,
  type Instant,
  type Repeat,
  type ThreadListItem,
} from "@weft/contracts";

import { dateOf } from "./follow-up-date.ts";
import { historyLayout, laneOrder } from "./history.ts";

const today = calendarDay("2026-11-08");
const DAY = 86_400_000;
const noon = dateOf(today).getTime() + DAY / 2;
let ms = Date.UTC(2026, 9, 1);

function thread(name: string, resolved = false): ThreadListItem {
  return {
    threadId: makeId<"thread">(ms++, () => new Uint8Array(10)),
    name,
    resolvedAt: resolved ? (new Date(noon).toISOString() as Instant) : null,
  };
}

function entry(
  body: string,
  options: {
    daysAgo?: number;
    day?: string;
    repeat?: Repeat;
    completedDaysAgo?: number;
    putAway?: boolean;
    parent?: EntryId;
    on?: ThreadListItem[];
  } = {},
): EntryListItem {
  const at = noon - (options.daysAgo ?? 0) * DAY;
  return {
    entryId: makeId<"entry">(ms++, () => new Uint8Array(10)),
    body,
    writtenAt: new Date(at).toISOString() as Instant,
    parentEntryId: options.parent ?? null,
    putAway: options.putAway ?? false,
    followUpDate: options.day
      ? {
          day: calendarDay(options.day),
          time: null,
          repeat: options.repeat ?? null,
        }
      : null,
    completed:
      options.completedDaysAgo === undefined
        ? null
        : {
            at: new Date(
              noon - options.completedDaysAgo * DAY,
            ).toISOString() as Instant,
            followUpDate: {
              day: today,
              time: null,
              repeat: null,
            },
          },
    threadIds: (options.on ?? []).map((each) => each.threadId),
  };
}

const layout = (
  entries: EntryListItem[],
  threads: ThreadListItem[],
  now = noon,
) => historyLayout({ entries, threads, today, now, width: 900 });

const dotOf = (result: ReturnType<typeof layout>, body: string) =>
  result.dots.find((dot) => dot.entry.body === body)!;

test("one lane per open Thread, most recently active first", () => {
  const sleep = thread("Sleep");
  const teeth = thread("Teeth");
  const car = thread("Replace the car", true);
  const garden = thread("Garden");
  const result = layout(
    [
      entry("Slept badly", { daysAgo: 1, on: [sleep] }),
      entry("Night guard", { daysAgo: 3, on: [teeth] }),
      entry("Sold it", { on: [car] }),
    ],
    [sleep, teeth, car, garden],
  );
  expect(result.lanes.map((lane) => lane.thread.name)).toEqual([
    "Sleep",
    "Teeth",
    "Garden",
  ]);
  expect(result.dots.map((dot) => dot.entry.body)).toEqual([
    "Night guard",
    "Slept badly",
  ]);
});

test("Threads that share Entries sit side by side", () => {
  const teeth = thread("Teeth");
  const work = thread("Work stress");
  const sleep = thread("Sleep");
  const order = laneOrder(
    [teeth, work, sleep],
    [
      entry("Deadline", { on: [work] }),
      entry("Dentist", { daysAgo: 2, on: [teeth, sleep] }),
      entry("Night guard", { daysAgo: 1, on: [teeth] }),
    ],
  );
  expect(order.map((each) => each.name)).toEqual([
    "Work stress",
    "Teeth",
    "Sleep",
  ]);
});

test("an Entry on two Threads is one dot spanning both lanes", () => {
  const teeth = thread("Teeth");
  const sleep = thread("Sleep");
  const result = layout(
    [entry("Dentist", { on: [sleep, teeth] })],
    [teeth, sleep],
  );
  const dot = dotOf(result, "Dentist");
  expect(dot.threadIds).toEqual(result.lanes.map((l) => l.thread.threadId));
  expect(dot.ys).toEqual(result.lanes.map((l) => l.y));
});

test("Loose Entries sit in their own band; put-away Entries and their Updates are left out", () => {
  const teeth = thread("Teeth");
  const away = entry("Old idea", { putAway: true });
  const result = layout(
    [
      entry("Desk chair?", { daysAgo: 2 }),
      entry("Night guard", { on: [teeth] }),
      away,
      entry("More on it", { parent: away.entryId }),
    ],
    [teeth],
  );
  expect(result.dots.map((dot) => dot.entry.body)).toEqual([
    "Desk chair?",
    "Night guard",
  ]);
  const loose = dotOf(result, "Desk chair?");
  expect(loose.threadIds).toEqual([]);
  expect(loose.ys[0]).toBeGreaterThan(result.looseTop);
  expect(result.loose).toBe(1);
});

test("an Entry sits where it was written or completed, and an asking one at its Follow-up date", () => {
  const result = layout(
    [
      entry("Written", { daysAgo: 10 }),
      entry("Completed", { daysAgo: 20, completedDaysAgo: 5 }),
      entry("Coming", { daysAgo: 20, day: "2026-11-20" }),
      entry("Late", { day: "2026-11-02" }),
    ],
    [],
  );
  const x = (body: string) => dotOf(result, body).x;
  const perDay = (x("Written") - x("Completed")) / -5;
  expect(perDay).toBeGreaterThan(0);
  expect(x("Coming") - result.today).toBeCloseTo(11.5 * perDay, 5);
  expect(dotOf(result, "Coming")).toMatchObject({ asking: true, late: false });
  expect(dotOf(result, "Late")).toMatchObject({ asking: true, late: true });
  expect(dotOf(result, "Written")).toMatchObject({
    asking: false,
    late: false,
  });
});

test("a Repeat is one dot at its next occurrence, labelled with its rhythm", () => {
  const result = layout(
    [
      entry("Stretch before bed", {
        day: "2026-11-09",
        repeat: { kind: "weekly", weekdays: [1] },
      }),
    ],
    [],
  );
  expect(result.dots).toHaveLength(1);
  expect(result.dots[0]).toMatchObject({
    rhythm: "every Monday",
    label: { text: "↻ every Monday" },
  });
  expect(result.dots[0]!.x).toBeGreaterThan(result.today);
});

test("an Update is joined to the Entry it follows from", () => {
  const claim = thread("Claim");
  const call = entry("Call about the claim", { daysAgo: 4, on: [claim] });
  const appeal = entry("Appeal", {
    parent: call.entryId,
    day: "2026-11-20",
    on: [claim],
  });
  const result = layout([appeal, call], [claim]);
  expect(result.joins).toEqual([
    {
      from: {
        x: dotOf(result, "Call about the claim").x,
        y: result.lanes[0]!.y,
      },
      to: { x: dotOf(result, "Appeal").x, y: result.lanes[0]!.y },
    },
  ]);
  expect(result.lanes[0]).toMatchObject({
    to: result.today,
    until: dotOf(result, "Appeal").x,
    entries: 2,
    asking: 1,
  });
});

test("dots too close in a lane move apart, away from today, and never across it", () => {
  const teeth = thread("Teeth");
  const result = layout(
    [
      entry("First", { daysAgo: 0.02, on: [teeth] }),
      entry("Second", { daysAgo: 0.01, on: [teeth] }),
      entry("Tomorrow", { day: "2026-11-09", on: [teeth] }),
      entry("Loose, same time", { daysAgo: 0.01 }),
    ],
    [teeth],
    noon + DAY / 2 - 60_000,
  );
  const x = (body: string) => dotOf(result, body).x;
  expect(x("Second") - x("First")).toBeCloseTo(14, 5);
  expect(x("Second")).toBeLessThanOrEqual(result.today);
  expect(x("Tomorrow") - x("Second")).toBeGreaterThanOrEqual(14);
  expect(x("Loose, same time")).toBe(x("Second"));
});

test("a crowded day widens the timeline instead of piling dots at its edge", () => {
  const teeth = thread("Teeth");
  const many = Array.from({ length: 60 }, (_, i) =>
    entry(`Note ${i}`, { daysAgo: i / 10_000, on: [teeth] }),
  );
  const result = layout(many, [teeth]);
  const xs = result.dots.map((dot) => dot.x);
  expect(Math.min(...xs)).toBeCloseTo(6, 5);
  for (let i = 1; i < xs.length; i++) {
    expect(xs[i]! - xs[i - 1]!).toBeCloseTo(14, 5);
  }
  expect(Math.max(...xs)).toBeLessThanOrEqual(result.today);
  expect(result.width).toBeGreaterThan(result.today);
});
