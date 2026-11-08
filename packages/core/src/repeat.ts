import { calendarDay, type CalendarDay } from "./dates.ts";
import type { FollowUpDate, Repeat } from "./follow-up-date.ts";

const DAY_MS = 86_400_000;
const LAST_DAY = toDays(calendarDay("9999-12-31"));

/**
 * Where a Follow-up date moves when it is Completed: its Repeat's first
 * occurrence after both the day it was on and today, so missed occurrences
 * collapse into one. Null when it does not repeat.
 */
export function nextFollowUpDate(
  completed: FollowUpDate,
  today: CalendarDay,
): FollowUpDate | null {
  if (completed.repeat === null) return null;
  const day = toDays(completed.day);
  const next = occurrenceAfter(
    completed.repeat,
    day,
    Math.max(day, toDays(today)),
  );
  if (next > LAST_DAY) {
    throw new RangeError(`A Repeat from ${completed.day} passes 9999-12-31.`);
  }
  return { ...completed, day: fromDays(next) };
}

function occurrenceAfter(repeat: Repeat, day: number, after: number): number {
  switch (repeat.kind) {
    case "days":
      return (
        day + (Math.floor((after - day) / repeat.every) + 1) * repeat.every
      );
    case "weekly": {
      // Day 0, 1970-01-01, was a Thursday.
      const weekday = (((after + 4) % 7) + 7) % 7;
      return (
        after +
        Math.min(...repeat.weekdays.map((w) => ((w - weekday + 6) % 7) + 1))
      );
    }
    case "monthly": {
      const date = new Date(after * DAY_MS);
      const year = date.getUTCFullYear();
      const month = date.getUTCMonth();
      const thisMonth = monthlyDay(year, month, repeat.day);
      return thisMonth > after
        ? thisMonth
        : monthlyDay(year, month + 1, repeat.day);
    }
  }
}

function monthlyDay(year: number, month: number, chosen: number): number {
  const length = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return Date.UTC(year, month, Math.min(chosen, length)) / DAY_MS;
}

/** Read in UTC so the host's time zone never enters. */
function toDays(day: CalendarDay): number {
  const [year, month, date] = day.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  return Date.UTC(year, month - 1, date) / DAY_MS;
}

function fromDays(days: number): CalendarDay {
  return calendarDay(new Date(days * DAY_MS).toISOString().slice(0, 10));
}
