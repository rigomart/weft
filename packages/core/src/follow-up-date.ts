import type { CalendarDay, TimeOfDay } from "./dates.ts";
import {
  calendarDay,
  EventShapeError,
  integer,
  literal,
  nullable,
  record,
  timeOfDay,
  type Reader,
} from "./shape.ts";

/** The rhythms a Repeat can have, as Vita OS stores them, so the importer keeps them (ADR 0009). */
export type Repeat =
  | { readonly kind: "days"; readonly every: number }
  /** Weekdays from 0, Sunday, to 6, Saturday, ascending. */
  | { readonly kind: "weekly"; readonly weekdays: readonly number[] }
  | { readonly kind: "monthly"; readonly day: number };

/** A calendar day with an optional local time of day (ADR 0006), and an optional Repeat. */
export interface FollowUpDate {
  readonly day: CalendarDay;
  readonly time: TimeOfDay | null;
  readonly repeat: Repeat | null;
}

const weekdays: Reader<readonly number[]> = (value, path) => {
  if (!Array.isArray(value) || value.length === 0) {
    throw new EventShapeError(path, "is not a list of at least one weekday");
  }
  const weekday = integer(0, 6);
  return value.map((day: unknown, index) => {
    const read = weekday(day, `${path}[${index}]`);
    if (index > 0 && read <= (value[index - 1] as number)) {
      throw new EventShapeError(
        `${path}[${index}]`,
        "is not after the weekday before it",
      );
    }
    return read;
  });
};

const repeats = {
  days: record({ kind: literal("days"), every: integer(1, 365) }),
  weekly: record({ kind: literal("weekly"), weekdays }),
  monthly: record({ kind: literal("monthly"), day: integer(1, 31) }),
} satisfies { [K in Repeat["kind"]]: Reader<Extract<Repeat, { kind: K }>> };

export const repeat: Reader<Repeat> = (value, path) => {
  const kind =
    typeof value === "object" && value !== null
      ? (value as { kind?: unknown }).kind
      : undefined;
  if (typeof kind !== "string" || !Object.hasOwn(repeats, kind)) {
    throw new EventShapeError(
      `${path}.kind`,
      'is not "days", "weekly" or "monthly"',
    );
  }
  return repeats[kind as Repeat["kind"]](value, path);
};

export const followUpDate: Reader<FollowUpDate> = record({
  day: calendarDay,
  time: nullable(timeOfDay),
  repeat: nullable(repeat),
});
