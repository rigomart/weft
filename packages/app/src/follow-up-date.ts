import {
  localCalendarDay,
  type CalendarDay,
  type FollowUpDate,
  type Repeat,
} from "@weft/contracts";

const DAY_MS = 86_400_000;
const A_SUNDAY = Date.UTC(2026, 10, 1);

/** The calendar day `at` falls on in this device's time zone (ADR 0006). */
export function localDay(at: Date = new Date()): CalendarDay {
  return localCalendarDay(at.getTime());
}

/** How many days `to` is after `from`: negative when it is before. */
export function daysFrom(from: CalendarDay, to: CalendarDay): number {
  return Math.round((utcMs(to) - utcMs(from)) / DAY_MS);
}

/**
 * When a Follow-up date brings its Entry back, said from `today`: "Today", "Tomorrow", "Yesterday",
 * a weekday in the coming week, or the date, each with its time when it has one ("Tomorrow, 9:30").
 */
export function followUpLabel(
  date: FollowUpDate,
  today: CalendarDay,
  locale?: string,
): string {
  const day = dayLabel(date.day, today, locale);
  return date.time === null ? day : `${day}, ${timeName(date.time)}`;
}

function dayLabel(day: CalendarDay, today: CalendarDay, locale?: string) {
  const n = daysFrom(today, day);
  if (n === 0) return "Today";
  if (n === 1) return "Tomorrow";
  if (n === -1) return "Yesterday";
  const date = new Date(utcMs(day));
  if (n > 1 && n < 7) {
    return date.toLocaleDateString(locale, {
      weekday: "short",
      timeZone: "UTC",
    });
  }
  return date.toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    year: day.slice(0, 4) === today.slice(0, 4) ? undefined : "numeric",
    timeZone: "UTC",
  });
}

function utcMs(day: CalendarDay): number {
  return Date.parse(`${day}T00:00:00Z`);
}

/** A Repeat's rhythm, as a row on Now shows it after ↻: "every Sunday", "every 3 days". */
export function repeatLabel(repeat: Repeat, locale?: string): string {
  switch (repeat.kind) {
    case "days":
      return repeat.every === 1 ? "every day" : `every ${repeat.every} days`;
    case "weekly":
      if (repeat.weekdays.length === 7) return "every day";
      return `every ${repeat.weekdays
        .map((weekday) =>
          weekdayName(
            weekday,
            repeat.weekdays.length === 1 ? "long" : "short",
            locale,
          ),
        )
        .join(", ")}`;
    case "monthly":
      return `every month on the ${ordinal(repeat.day)}`;
  }
}

/** The weekday's name, "Sunday" or "Sun" when `short`; 0 is Sunday. */
export function weekdayName(
  weekday: number,
  width: "long" | "short",
  locale?: string,
): string {
  return new Date(A_SUNDAY + weekday * DAY_MS).toLocaleDateString(locale, {
    weekday: width,
    timeZone: "UTC",
  });
}

/** 0 is Sunday. */
export function weekdayOf(day: CalendarDay): number {
  return new Date(utcMs(day)).getUTCDay();
}

function ordinal(n: number): string {
  const suffix = { one: "st", two: "nd", few: "rd", other: "th" } as const;
  const rule = new Intl.PluralRules("en-US", { type: "ordinal" }).select(n);
  return `${n}${suffix[rule as keyof typeof suffix] ?? "th"}`;
}

/** Local midnight on `day`, as the calendar picker takes it. */
export function dateOf(day: CalendarDay): Date {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y!, m! - 1, d!);
}

export function addDays(day: CalendarDay, n: number): CalendarDay {
  const date = dateOf(day);
  date.setDate(date.getDate() + n);
  return localDay(date);
}

/** "Sun, Nov 15", or "Sunday, November 15" when `long`; with the year when it is not this year. */
export function dayName(
  day: CalendarDay,
  today: CalendarDay,
  long = false,
  locale?: string,
): string {
  return dateOf(day).toLocaleDateString(locale, {
    weekday: long ? "long" : "short",
    month: long ? "long" : "short",
    day: "numeric",
    year: day.slice(0, 4) === today.slice(0, 4) ? undefined : "numeric",
  });
}

/** "9:30" from "09:30", as a card shows a time. */
export function timeName(time: string): string {
  return time.replace(/^0/, "");
}

/**
 * A time of day typed the way people type one: "9", "930", "9:30", "9.30", "14h15", "2pm",
 * "2:30 pm". Gives "HH:MM", or undefined when it is not a time.
 */
export function parseTime(text: string): string | undefined {
  const match = /^(\d{1,2})(?:[:.h]?(\d{2}))?\s*(am|pm|a|p)?$/.exec(
    text.trim().toLowerCase(),
  );
  if (!match) return undefined;
  let hour = Number(match[1]);
  const minute = match[2] === undefined ? 0 : Number(match[2]);
  const half = match[3]?.[0];
  if (minute > 59) return undefined;
  if (half) {
    if (hour < 1 || hour > 12) return undefined;
    hour = (hour % 12) + (half === "p" ? 12 : 0);
  }
  if (hour > 23) return undefined;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/** Every half hour from 7:00 to 21:30: the times offered before anything is typed. */
export const commonTimes: readonly string[] = Array.from(
  { length: 30 },
  (_, i) =>
    `${String(7 + Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`,
);

/** The days offered before the calendar: today, tomorrow, and a week from today. */
export function quickDays(today: CalendarDay) {
  return [
    { label: "Today", day: today },
    { label: "Tomorrow", day: addDays(today, 1) },
    { label: "Next week", day: addDays(today, 7) },
  ] as const;
}
