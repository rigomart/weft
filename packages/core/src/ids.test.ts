import { expect, test } from "bun:test";
import { idTime, isId, makeId } from "./ids.ts";
import { seededRandom } from "./test-device.ts";

const NOV_8 = Date.UTC(2026, 10, 8, 20, 55, 55, 123);

test("an ID is a UUID version 7 holding the millisecond it was made in", () => {
  const id = makeId(NOV_8, seededRandom(1));
  expect(isId(id)).toBe(true);
  expect(id.replaceAll("-", "").slice(0, 12)).toBe(
    NOV_8.toString(16).padStart(12, "0"),
  );
  expect(id[14]).toBe("7");
  expect(idTime(id)).toBe(NOV_8);
});

test("IDs sort by the millisecond they were made in", () => {
  const random = seededRandom(2);
  const ids = [NOV_8 + 1, NOV_8, NOV_8 + 1000, NOV_8 - 1].map((ms) =>
    makeId(ms, random),
  );
  expect([...ids].sort().map(idTime)).toEqual([
    NOV_8 - 1,
    NOV_8,
    NOV_8 + 1,
    NOV_8 + 1000,
  ]);
});

test("IDs made in the same millisecond differ", () => {
  const random = seededRandom(3);
  const ids = new Set(
    Array.from({ length: 1000 }, () => makeId(NOV_8, random)),
  );
  expect(ids.size).toBe(1000);
});

test("making an ID refuses a bad time or too few random bytes", () => {
  expect(() => makeId(-1, seededRandom(4))).toThrow(RangeError);
  expect(() => makeId(2 ** 48, seededRandom(4))).toThrow(RangeError);
  expect(() => makeId(NOV_8, () => new Uint8Array(9))).toThrow(RangeError);
});
