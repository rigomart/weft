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

/** A Repeat's rhythm, as a card on Now shows it after ↻: "every Sunday", "every 3 days". */
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
