import { expect, test } from "bun:test";
import { calendarDay, timeOfDay, type FollowUpDate } from "@weft/contracts";

import {
  dayName,
  daysFrom,
  followUpLabel,
  localDay,
  parseTime,
  quickDays,
  repeatLabel,
  weekdayOf,
} from "./follow-up-date.ts";

const today = calendarDay("2026-11-08");

function on(day: string, time: string | null = null): FollowUpDate {
  return {
    day: calendarDay(day),
    time: time === null ? null : timeOfDay(time),
    repeat: null,
  };
}

test("the local day is the device's calendar day, not UTC's", () => {
  expect(localDay(new Date(2026, 10, 8, 23, 59))).toBe(today);
  expect(localDay(new Date(2026, 10, 9, 0, 0))).toBe(calendarDay("2026-11-09"));
});

test("counts calendar days across months, years and clock changes", () => {
  expect(daysFrom(today, calendarDay("2026-11-09"))).toBe(1);
  expect(daysFrom(today, calendarDay("2026-11-01"))).toBe(-7);
  expect(daysFrom(calendarDay("2026-12-31"), calendarDay("2027-01-01"))).toBe(
    1,
  );
  expect(daysFrom(calendarDay("2026-03-07"), calendarDay("2026-03-09"))).toBe(
    2,
  );
});

test("says the day from today, with its time when it has one", () => {
  const label = (day: string, time: string | null = null) =>
    followUpLabel(on(day, time), today, "en-US");
  expect(label("2026-11-08")).toBe("Today");
  expect(label("2026-11-09", "09:30")).toBe("Tomorrow, 9:30");
  expect(label("2026-11-07", "14:05")).toBe("Yesterday, 14:05");
  expect(label("2026-11-12")).toBe("Thu");
  expect(label("2026-11-14")).toBe("Sat");
  expect(label("2026-11-15")).toBe("Nov 15");
  expect(label("2026-11-06")).toBe("Nov 6");
  expect(label("2027-01-04", "00:00")).toBe("Jan 4, 2027, 0:00");
});

test("says a Repeat's rhythm", () => {
  const label = (repeat: Parameters<typeof repeatLabel>[0]) =>
    repeatLabel(repeat, "en-US");
  expect(label({ kind: "weekly", weekdays: [0] })).toBe("every Sunday");
  expect(label({ kind: "weekly", weekdays: [1, 3, 5] })).toBe(
    "every Mon, Wed, Fri",
  );
  expect(label({ kind: "weekly", weekdays: [0, 1, 2, 3, 4, 5, 6] })).toBe(
    "every day",
  );
  expect(label({ kind: "days", every: 1 })).toBe("every day");
  expect(label({ kind: "days", every: 3 })).toBe("every 3 days");
  expect(label({ kind: "monthly", day: 1 })).toBe("every month on the 1st");
  expect(label({ kind: "monthly", day: 22 })).toBe("every month on the 22nd");
  expect(label({ kind: "monthly", day: 13 })).toBe("every month on the 13th");
  expect(label({ kind: "monthly", day: 31 })).toBe("every month on the 31st");
});

test("the weekday of a calendar day, from 0, Sunday", () => {
  expect(weekdayOf(calendarDay("2026-11-08"))).toBe(0);
  expect(weekdayOf(calendarDay("2026-11-14"))).toBe(6);
});

test("reads a time typed the way people type one", () => {
  expect(
    ["9", "930", "9:30", "9.30", "14h15", "2pm", "2:30 pm", "12am", "12pm"].map(
      parseTime,
    ),
  ).toEqual([
    "09:00",
    "09:30",
    "09:30",
    "09:30",
    "14:15",
    "14:00",
    "14:30",
    "00:00",
    "12:00",
  ]);
  expect(["", "24", "9:60", "13pm", "0am", "soon"].map(parseTime)).toEqual([
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
  ]);
});

test("offers today, tomorrow and a week from today, across a month's end", () => {
  expect(quickDays(calendarDay("2026-11-29"))).toEqual([
    { label: "Today", day: calendarDay("2026-11-29") },
    { label: "Tomorrow", day: calendarDay("2026-11-30") },
    { label: "Next week", day: calendarDay("2026-12-06") },
  ]);
});

test("names a day, with the year only when it is not this year", () => {
  expect(dayName(today, today, true, "en-US")).toBe("Sunday, November 8");
  expect(dayName(calendarDay("2026-11-15"), today, false, "en-US")).toBe(
    "Sun, Nov 15",
  );
  expect(dayName(calendarDay("2027-01-03"), today, false, "en-US")).toBe(
    "Sun, Jan 3, 2027",
  );
});
