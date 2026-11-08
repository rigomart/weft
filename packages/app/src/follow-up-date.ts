import {
  calendarDay,
  type CalendarDay,
  type FollowUpDate,
} from "@weft/contracts";

const DAY_MS = 86_400_000;

/** The calendar day `at` falls on in this device's time zone (ADR 0006). */
export function localDay(at: Date = new Date()): CalendarDay {
  const pad = (n: number) => String(n).padStart(2, "0");
  return calendarDay(
    `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`,
  );
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
  return date.time === null ? day : `${day}, ${date.time.replace(/^0/, "")}`;
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
