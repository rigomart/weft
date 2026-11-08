/** A moment that happened, in UTC to the millisecond: `2026-11-08T20:55:55.123Z`. */
export type Instant = string & { readonly __brand: "Instant" };

/** A day on the calendar, with no time zone: `2026-11-15`. */
export type CalendarDay = string & { readonly __brand: "CalendarDay" };

/** A local time of day, to the minute: `09:30`. */
export type TimeOfDay = string & { readonly __brand: "TimeOfDay" };

const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const CALENDAR_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_OF_DAY = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isInstant(value: unknown): value is Instant {
  return (
    typeof value === "string" &&
    INSTANT.test(value) &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString() === value
  );
}

export function isCalendarDay(value: unknown): value is CalendarDay {
  if (typeof value !== "string") return false;
  const match = CALENDAR_DAY.exec(value);
  if (!match) return false;
  const [year, month, day] = [match[1], match[2], match[3]].map(Number) as [
    number,
    number,
    number,
  ];
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function isTimeOfDay(value: unknown): value is TimeOfDay {
  return typeof value === "string" && TIME_OF_DAY.test(value);
}

/** Throws for a time outside years 0000 to 9999, which an instant cannot hold. */
export function instantFromMs(ms: number): Instant {
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) {
    throw new RangeError(`Not a time: ${ms}.`);
  }
  return instant(date.toISOString());
}

/** The calendar day `ms` falls on in this device's time zone (ADR 0006). */
export function localCalendarDay(ms: number): CalendarDay {
  const date = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return calendarDay(
    `${String(date.getFullYear()).padStart(4, "0")}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
  );
}

export function instant(value: string): Instant {
  if (!isInstant(value))
    throw new SyntaxError(`Not an instant: ${JSON.stringify(value)}.`);
  return value;
}

export function calendarDay(value: string): CalendarDay {
  if (!isCalendarDay(value))
    throw new SyntaxError(`Not a calendar day: ${JSON.stringify(value)}.`);
  return value;
}

export function timeOfDay(value: string): TimeOfDay {
  if (!isTimeOfDay(value))
    throw new SyntaxError(`Not a time of day: ${JSON.stringify(value)}.`);
  return value;
}
