import type { CalendarDay, EntryId, EntryListItem } from "@weft/contracts";

import { daysFrom } from "./follow-up-date.ts";

export const groupNames = [
  "Late",
  "Today",
  "Tomorrow",
  "This week",
  "Later",
] as const;

export type GroupName = (typeof groupNames)[number];

/** Which group on Now a Follow-up date on `day` falls in, seen from `today`. */
export function groupOf(day: CalendarDay, today: CalendarDay): GroupName {
  const n = daysFrom(today, day);
  if (n < 0) return "Late";
  if (n === 0) return "Today";
  if (n === 1) return "Tomorrow";
  if (n < 7) return "This week";
  return "Later";
}

export interface Glance {
  /** Only the groups with Entries in them, in `groupNames` order. */
  readonly groups: readonly {
    readonly name: GroupName;
    readonly entries: readonly EntryListItem[];
  }[];
  /** Newest first, as `entries` lists them. */
  readonly loose: readonly EntryListItem[];
}

/**
 * What Now shows. Entries with a Follow-up date are grouped by when they come back, each group by
 * day, then time (a day without a time first), then by when they were written. Loose Entries are
 * the rest of the top-level Entries on no Thread. Put-away Entries, and Updates to them, show in
 * neither.
 *
 * `entries` is the "entries" read, newest first.
 */
export function glance(
  entries: readonly EntryListItem[],
  today: CalendarDay,
): Glance {
  const byId = new Map(entries.map((entry) => [entry.entryId, entry]));
  const shown = entries.filter((entry) => !isPutAway(entry, byId));

  const comingBack = shown
    .filter((entry) => entry.followUpDate !== null)
    .sort(byFollowUpDate);
  const groups = groupNames
    .map((name) => ({
      name,
      entries: comingBack.filter(
        (entry) => groupOf(entry.followUpDate!.day, today) === name,
      ),
    }))
    .filter((group) => group.entries.length > 0);

  const loose = shown.filter(
    (entry) =>
      entry.parentEntryId === null &&
      entry.threadIds.length === 0 &&
      entry.followUpDate === null,
  );
  return { groups, loose };
}

/** An Update is put away with the Entry it was added to. */
function isPutAway(
  entry: EntryListItem,
  byId: ReadonlyMap<EntryId, EntryListItem>,
): boolean {
  const seen = new Set<EntryId>();
  let current: EntryListItem | undefined = entry;
  while (current && !seen.has(current.entryId)) {
    if (current.putAway) return true;
    seen.add(current.entryId);
    current =
      current.parentEntryId === null
        ? undefined
        : byId.get(current.parentEntryId);
  }
  return false;
}

function byFollowUpDate(a: EntryListItem, b: EntryListItem): number {
  const x = a.followUpDate!;
  const y = b.followUpDate!;
  return (
    compare(x.day, y.day) ||
    compare(x.time ?? "", y.time ?? "") ||
    compare(a.writtenAt, b.writtenAt) ||
    compare(a.entryId, b.entryId)
  );
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
