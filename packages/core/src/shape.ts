import {
  isCalendarDay,
  isInstant,
  isTimeOfDay,
  type CalendarDay,
  type Instant,
  type TimeOfDay,
} from "./dates.ts";
import { isId, type Id } from "./ids.ts";

/** A stored or new event that does not have the shape its type and version say. */
export class EventShapeError extends Error {
  constructor(
    readonly path: string,
    problem: string,
  ) {
    super(`${path} ${problem}`);
    this.name = "EventShapeError";
  }
}

/** Reads one value of an event, by its path in the event, or throws an `EventShapeError`. */
export type Reader<T> = (value: unknown, path: string) => T;

type Read<Fields> = {
  readonly [K in keyof Fields]: Fields[K] extends Reader<infer T> ? T : never;
};

/** An object with exactly these fields: a missing or an extra one is refused. */
export function record<Fields extends Record<string, Reader<unknown>>>(
  fields: Fields,
): Reader<Read<Fields>> {
  return (value, path) => {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      throw new EventShapeError(path, "is not an object");
    }
    for (const key of Object.keys(value)) {
      if (!Object.hasOwn(fields, key)) {
        throw new EventShapeError(
          `${path}.${key}`,
          "is not part of this shape",
        );
      }
    }
    const result: Record<string, unknown> = {};
    for (const [key, read] of Object.entries(fields)) {
      if (!Object.hasOwn(value, key)) {
        throw new EventShapeError(`${path}.${key}`, "is missing");
      }
      result[key] = read(
        (value as Record<string, unknown>)[key],
        `${path}.${key}`,
      );
    }
    return result as Read<Fields>;
  };
}

export function nullable<T>(read: Reader<T>): Reader<T | null> {
  return (value, path) => (value === null ? null : read(value, path));
}

function check<T>(
  test: (value: unknown) => value is T,
  problem: string,
): Reader<T> {
  return (value, path) => {
    if (!test(value)) throw new EventShapeError(path, problem);
    return value;
  };
}

export function literal<const T extends string | number>(
  expected: T,
): Reader<T> {
  return check(
    (value): value is T => value === expected,
    `is not ${JSON.stringify(expected)}`,
  );
}

export function integer(min: number, max: number): Reader<number> {
  return check(
    (value): value is number =>
      Number.isInteger(value) &&
      (value as number) >= min &&
      (value as number) <= max,
    `is not a whole number from ${min} to ${max}`,
  );
}

export const text: Reader<string> = check(
  (value): value is string => typeof value === "string" && value.trim() !== "",
  "is not text with something in it",
);

export function id<Kind extends string>(): Reader<Id<Kind>> {
  return check((value): value is Id<Kind> => isId(value), "is not an ID");
}

export const instant: Reader<Instant> = check(isInstant, "is not an instant");
export const calendarDay: Reader<CalendarDay> = check(
  isCalendarDay,
  "is not a calendar day",
);
export const timeOfDay: Reader<TimeOfDay> = check(
  isTimeOfDay,
  "is not a time of day",
);
