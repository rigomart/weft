import { expect, test } from "bun:test";
import {
  instantFromMs,
  isCalendarDay,
  isInstant,
  isTimeOfDay,
} from "./dates.ts";

test("an instant is UTC to the millisecond", () => {
  expect<string>(instantFromMs(Date.UTC(2026, 10, 8, 20, 55, 55, 123))).toBe(
    "2026-11-08T20:55:55.123Z",
  );
  expect(isInstant("2026-11-08T20:55:55.123Z")).toBe(true);
  for (const value of [
    "2026-11-08T20:55:55Z",
    "2026-11-08T20:55:55.123+01:00",
    "2026-13-08T20:55:55.123Z",
    "2026-11-08",
  ]) {
    expect(isInstant(value)).toBe(false);
  }
});

test("a calendar day must exist", () => {
  expect(isCalendarDay("2026-11-15")).toBe(true);
  expect(isCalendarDay("2028-02-29")).toBe(true);
  for (const value of [
    "2026-02-29",
    "2026-04-31",
    "2026-11-5",
    "2026-11-15T00:00",
    "20261115",
  ]) {
    expect(isCalendarDay(value)).toBe(false);
  }
});

test("a time of day is hours and minutes on a 24-hour clock", () => {
  expect(isTimeOfDay("00:00")).toBe(true);
  expect(isTimeOfDay("23:59")).toBe(true);
  for (const value of ["24:00", "9:30", "09:60", "09:30:00"]) {
    expect(isTimeOfDay(value)).toBe(false);
  }
});

test("an instant cannot be made from a time outside years 0000 to 9999", () => {
  expect<string>(instantFromMs(Date.UTC(9999, 11, 31, 23, 59, 59, 999))).toBe(
    "9999-12-31T23:59:59.999Z",
  );
  expect(() => instantFromMs(Date.UTC(10000, 0, 1))).toThrow(SyntaxError);
  expect(() => instantFromMs(Number.NaN)).toThrow(RangeError);
});
