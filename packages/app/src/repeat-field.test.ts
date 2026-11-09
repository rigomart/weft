import { expect, test } from "bun:test";

import { draftOf, repeatOf, startRepeat } from "./repeat-field.tsx";

test("a draft gives its Repeat, or none", () => {
  expect(repeatOf({ kind: "none" })).toBeNull();
  expect(repeatOf({ kind: "days", every: "3" })).toEqual({
    kind: "days",
    every: 3,
  });
  expect(repeatOf({ kind: "weekly", weekdays: [5, 0, 3] })).toEqual({
    kind: "weekly",
    weekdays: [0, 3, 5],
  });
  expect(repeatOf({ kind: "monthly", day: "31" })).toEqual({
    kind: "monthly",
    day: 31,
  });
});

test("a draft that cannot be a Repeat yet is incomplete", () => {
  for (const every of ["", "0", "366", "1.5", "two"]) {
    expect(repeatOf({ kind: "days", every })).toBe("incomplete");
  }
  expect(repeatOf({ kind: "weekly", weekdays: [] })).toBe("incomplete");
  for (const day of ["", "0", "32"]) {
    expect(repeatOf({ kind: "monthly", day })).toBe("incomplete");
  }
});

test("a new Repeat starts from the chosen day", () => {
  const sunday15th = { weekday: 0, date: 15 };
  expect(startRepeat("weekly", sunday15th)).toEqual({
    kind: "weekly",
    weekdays: [0],
  });
  expect(startRepeat("monthly", sunday15th)).toEqual({
    kind: "monthly",
    day: "15",
  });
  expect(startRepeat("days", sunday15th)).toEqual({ kind: "days", every: "1" });
  expect(startRepeat("none", sunday15th)).toEqual({ kind: "none" });
  expect(startRepeat("weekly", null)).toEqual({ kind: "weekly", weekdays: [] });
});

test("a Repeat gives back the draft that shows it", () => {
  for (const repeat of [
    null,
    { kind: "days", every: 3 },
    { kind: "weekly", weekdays: [0, 3] },
    { kind: "monthly", day: 31 },
  ] as const) {
    expect(repeatOf(draftOf(repeat))).toEqual(repeat);
  }
});
