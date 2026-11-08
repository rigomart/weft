import { expect, test } from "bun:test";
import { formatHlc, isHlc, parseHlc, receiveHlc, tickHlc } from "./hlc.ts";

const NOV_8 = Date.UTC(2026, 10, 8, 20, 55, 55, 123);

test("a timestamp reads as the UTC time and a counter, and parses back", () => {
  const hlc = formatHlc({ ms: NOV_8, counter: 26 });
  expect<string>(hlc).toBe("2026-11-08T20:55:55.123Z-001a");
  expect(parseHlc(hlc)).toEqual({ ms: NOV_8, counter: 26 });
});

test("timestamps order as strings", () => {
  const parts = [
    { ms: NOV_8, counter: 16 },
    { ms: NOV_8 + 1, counter: 0 },
    { ms: NOV_8, counter: 9 },
    { ms: NOV_8 - 86_400_000, counter: 65535 },
  ];
  const sorted = parts.map(formatHlc).sort().map(parseHlc);
  expect(sorted).toEqual([parts[3]!, parts[2]!, parts[0]!, parts[1]!]);
});

test("ticking moves to the wall clock, or counts up when it has not moved on", () => {
  expect(tickHlc(null, NOV_8)).toEqual({ ms: NOV_8, counter: 0 });
  expect(tickHlc({ ms: NOV_8, counter: 0 }, NOV_8)).toEqual({
    ms: NOV_8,
    counter: 1,
  });
  expect(tickHlc({ ms: NOV_8, counter: 4 }, NOV_8 - 5000)).toEqual({
    ms: NOV_8,
    counter: 5,
  });
  expect(tickHlc({ ms: NOV_8, counter: 4 }, NOV_8 + 1)).toEqual({
    ms: NOV_8 + 1,
    counter: 0,
  });
  expect(() => tickHlc({ ms: NOV_8, counter: 0xffff }, NOV_8)).toThrow(
    RangeError,
  );
});

test("receiving moves past the other device's timestamp", () => {
  const local = { ms: NOV_8, counter: 3 };
  expect(receiveHlc(local, { ms: NOV_8 + 10, counter: 7 }, NOV_8)).toEqual({
    ms: NOV_8 + 10,
    counter: 8,
  });
  expect(receiveHlc(local, { ms: NOV_8, counter: 7 }, NOV_8)).toEqual({
    ms: NOV_8,
    counter: 8,
  });
  expect(receiveHlc(local, { ms: NOV_8 - 10, counter: 7 }, NOV_8)).toEqual({
    ms: NOV_8,
    counter: 4,
  });
  expect(receiveHlc(local, { ms: NOV_8 - 10, counter: 7 }, NOV_8 + 1)).toEqual({
    ms: NOV_8 + 1,
    counter: 0,
  });
  expect(receiveHlc(null, { ms: NOV_8, counter: 2 }, NOV_8 - 1)).toEqual({
    ms: NOV_8,
    counter: 3,
  });
});

test("malformed timestamps are refused", () => {
  for (const value of [
    "2026-11-08T20:55:55.123Z-01a",
    "2026-11-08T20:55:55.123Z-001A",
    "2026-02-30T00:00:00.000Z-0000",
    "2026-11-08T20:55:55.123+00:00-0000",
    42,
  ]) {
    expect(isHlc(value)).toBe(false);
  }
  expect(() => formatHlc({ ms: NOV_8, counter: 0x10000 })).toThrow(RangeError);
});
