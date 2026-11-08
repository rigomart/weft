import { expect, test } from "bun:test";
import { calendarDay, timeOfDay, type FollowUpDate } from "@weft/contracts";

import { daysFrom, followUpLabel, localDay } from "./follow-up-date.ts";

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
