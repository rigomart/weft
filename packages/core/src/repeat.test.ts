import { describe, expect, test } from "bun:test";
import { calendarDay, timeOfDay } from "./dates.ts";
import type { FollowUpDate, Repeat } from "./follow-up-date.ts";
import { nextFollowUpDate } from "./repeat.ts";

const on = (day: string, repeat: Repeat | null): FollowUpDate => ({
  day: calendarDay(day),
  time: null,
  repeat,
});

function next(repeat: Repeat, day: string, today: string): string | undefined {
  return nextFollowUpDate(on(day, repeat), calendarDay(today))?.day;
}

test("a Follow-up date without a Repeat has no next occurrence", () => {
  expect(
    nextFollowUpDate(on("2026-11-08", null), calendarDay("2026-11-08")),
  ).toBeNull();
});

test("keeps the time of day and the Repeat", () => {
  const repeat: Repeat = { kind: "weekly", weekdays: [0] };
  const completed: FollowUpDate = {
    day: calendarDay("2026-11-08"),
    time: timeOfDay("09:30"),
    repeat,
  };
  expect(nextFollowUpDate(completed, calendarDay("2026-11-08"))).toEqual({
    day: calendarDay("2026-11-15"),
    time: timeOfDay("09:30"),
    repeat,
  });
});

describe("every N days", () => {
  const daily: Repeat = { kind: "days", every: 1 };
  const every3: Repeat = { kind: "days", every: 3 };

  test.each([
    ["on its day", daily, "2026-11-08", "2026-11-08", "2026-11-09"],
    [
      "Late, collapsing missed days",
      daily,
      "2026-11-01",
      "2026-11-08",
      "2026-11-09",
    ],
    [
      "early, past the day it was on",
      daily,
      "2026-11-12",
      "2026-11-08",
      "2026-11-13",
    ],
    ["on its day, every 3", every3, "2026-11-01", "2026-11-01", "2026-11-04"],
    [
      "Late, keeping its phase",
      every3,
      "2026-11-01",
      "2026-11-08",
      "2026-11-10",
    ],
    [
      "Late, today on an occurrence",
      every3,
      "2026-11-01",
      "2026-11-07",
      "2026-11-10",
    ],
    [
      "Late, the day before an occurrence",
      every3,
      "2026-11-01",
      "2026-11-06",
      "2026-11-07",
    ],
    ["early, every 3", every3, "2026-11-12", "2026-11-08", "2026-11-15"],
    ["across a year", daily, "2026-12-31", "2026-12-31", "2027-01-01"],
    ["onto a leap day", daily, "2028-02-28", "2028-02-28", "2028-02-29"],
    [
      "past February in a common year",
      daily,
      "2027-02-28",
      "2027-02-28",
      "2027-03-01",
    ],
    [
      "every 365 days through a leap year",
      { kind: "days", every: 365 },
      "2028-01-01",
      "2028-01-01",
      "2028-12-31",
    ],
  ] satisfies [string, Repeat, string, string, string][])(
    "%s",
    (_, repeat, day, today, expected) => {
      expect(next(repeat, day, today)).toBe(expected);
    },
  );
});

describe("weekly", () => {
  const sunday: Repeat = { kind: "weekly", weekdays: [0] };
  const tuesdayThursday: Repeat = { kind: "weekly", weekdays: [2, 4] };

  test.each([
    [
      "Late from last Sunday, completed on a Sunday",
      sunday,
      "2026-11-01",
      "2026-11-08",
      "2026-11-15",
    ],
    [
      "Late, completed midweek",
      sunday,
      "2026-11-01",
      "2026-11-05",
      "2026-11-08",
    ],
    [
      "on a day it does not repeat on",
      sunday,
      "2026-11-04",
      "2026-11-04",
      "2026-11-08",
    ],
    [
      "early, past the day it was on",
      sunday,
      "2026-11-15",
      "2026-11-08",
      "2026-11-22",
    ],
    [
      "to the next chosen weekday",
      tuesdayThursday,
      "2026-11-03",
      "2026-11-03",
      "2026-11-05",
    ],
    [
      "wrapping to next week's first",
      tuesdayThursday,
      "2026-11-05",
      "2026-11-05",
      "2026-11-10",
    ],
    [
      "Late across weeks, landing once",
      tuesdayThursday,
      "2026-11-03",
      "2026-11-12",
      "2026-11-17",
    ],
    [
      "across a year",
      { kind: "weekly", weekdays: [1] },
      "2026-12-28",
      "2026-12-28",
      "2027-01-04",
    ],
    ["before 1970", sunday, "1969-12-21", "1969-12-21", "1969-12-28"],
    [
      "all seven days",
      { kind: "weekly", weekdays: [0, 1, 2, 3, 4, 5, 6] },
      "2026-12-31",
      "2026-12-31",
      "2027-01-01",
    ],
  ] satisfies [string, Repeat, string, string, string][])(
    "%s",
    (_, repeat, day, today, expected) => {
      expect(next(repeat, day, today)).toBe(expected);
    },
  );
});

describe("monthly", () => {
  const on15: Repeat = { kind: "monthly", day: 15 };
  const on31: Repeat = { kind: "monthly", day: 31 };

  test.each([
    ["on its day", on15, "2026-10-15", "2026-10-15", "2026-11-15"],
    [
      "Late, collapsing missed months",
      on15,
      "2026-08-15",
      "2026-11-08",
      "2026-11-15",
    ],
    [
      "Late, today on an occurrence",
      on15,
      "2026-10-15",
      "2026-11-15",
      "2026-12-15",
    ],
    [
      "early, past the day it was on",
      on15,
      "2026-11-15",
      "2026-11-08",
      "2026-12-15",
    ],
    ["to February's last day", on31, "2026-01-31", "2026-01-31", "2026-02-28"],
    [
      "back to the 31st after February",
      on31,
      "2026-02-28",
      "2026-02-28",
      "2026-03-31",
    ],
    [
      "to the 30th in a 30-day month",
      on31,
      "2026-03-31",
      "2026-03-31",
      "2026-04-30",
    ],
    ["to a leap day", on31, "2028-01-31", "2028-01-31", "2028-02-29"],
    [
      "the 30th to a leap day",
      { kind: "monthly", day: 30 },
      "2028-01-30",
      "2028-01-30",
      "2028-02-29",
    ],
    [
      "the 29th in a common February",
      { kind: "monthly", day: 29 },
      "2027-01-29",
      "2027-01-29",
      "2027-02-28",
    ],
    ["across a year", on31, "2026-12-31", "2026-12-31", "2027-01-31"],
  ] satisfies [string, Repeat, string, string, string][])(
    "%s",
    (_, repeat, day, today, expected) => {
      expect(next(repeat, day, today)).toBe(expected);
    },
  );
});

test("refuses an occurrence past the last calendar day", () => {
  expect(() =>
    next({ kind: "days", every: 1 }, "9999-12-31", "9999-12-31"),
  ).toThrow(RangeError);
});
