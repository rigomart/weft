import type {
  CalendarDay,
  EntryId,
  EntryListItem,
  ThreadId,
} from "@weft/contracts";

import { daysFrom } from "./follow-up-date.ts";

/** The Entry an Update's chain of Updates started from; an Entry with no parent is its own. */
export function firstEntryOf(
  entry: EntryListItem,
  byId: ReadonlyMap<EntryId, EntryListItem>,
): EntryListItem {
  const seen = new Set<EntryId>([entry.entryId]);
  let current = entry;
  for (;;) {
    const parent =
      current.parentEntryId === null
        ? undefined
        : byId.get(current.parentEntryId);
    if (!parent || seen.has(parent.entryId)) return current;
    seen.add(parent.entryId);
    current = parent;
  }
}

export interface StoryLine {
  readonly entry: EntryListItem;
  /** How far to indent it: one step more only where an Entry has several Updates. */
  readonly depth: number;
}

/**
 * The first Entry `entry`'s chain started from, then every Update under it, each before its own
 * Updates, in the order they were written.
 */
export function storyOf(
  entry: EntryListItem,
  entries: readonly EntryListItem[],
): StoryLine[] {
  const byId = new Map(entries.map((each) => [each.entryId, each]));
  const updates = new Map<EntryId, EntryListItem[]>();
  for (const each of entries) {
    if (each.parentEntryId === null) continue;
    updates.set(each.parentEntryId, [
      ...(updates.get(each.parentEntryId) ?? []),
      each,
    ]);
  }
  const lines: StoryLine[] = [];
  const seen = new Set<EntryId>();
  function visit(current: EntryListItem, depth: number) {
    if (seen.has(current.entryId)) return;
    seen.add(current.entryId);
    lines.push({ entry: current, depth });
    const next = [...(updates.get(current.entryId) ?? [])].sort(byWritten);
    for (const update of next) visit(update, depth + (next.length > 1 ? 1 : 0));
  }
  visit(firstEntryOf(entry, byId), 0);
  return lines;
}

function byWritten(a: EntryListItem, b: EntryListItem): number {
  return a.writtenAt < b.writtenAt
    ? -1
    : a.writtenAt > b.writtenAt
      ? 1
      : a.entryId < b.entryId
        ? -1
        : 1;
}

export interface ThreadStory {
  /** What happened, oldest first, with any late Follow-up date at its own day. */
  readonly happened: readonly EntryListItem[];
  /** What is coming, from today on, by Follow-up date. */
  readonly coming: readonly EntryListItem[];
}

/**
 * Every Entry and Update on `threadId`, put away or not, split at today. An Entry with a
 * Follow-up date from today on is coming; the rest happened, placed at their Follow-up date when
 * late, else when they were completed, else when they were written.
 */
export function threadStory(
  threadId: ThreadId,
  entries: readonly EntryListItem[],
  today: CalendarDay,
): ThreadStory {
  const on = entries.filter((entry) => entry.threadIds.includes(threadId));
  const isComing = (entry: EntryListItem) =>
    entry.followUpDate !== null && daysFrom(today, entry.followUpDate.day) >= 0;
  return {
    happened: on
      .filter((entry) => !isComing(entry))
      .sort((a, b) => compare(happenedAt(a), happenedAt(b)) || byWritten(a, b)),
    coming: on
      .filter(isComing)
      .sort((a, b) => compare(comingAt(a), comingAt(b)) || byWritten(a, b)),
  };
}

function happenedAt(entry: EntryListItem): string {
  if (entry.followUpDate) return comingAt(entry);
  return localStamp(entry.completed?.at ?? entry.writtenAt);
}

function comingAt(entry: EntryListItem): string {
  const { day, time } = entry.followUpDate!;
  return `${day}T${time ?? "00:00"}`;
}

function localStamp(instant: string): string {
  const at = new Date(instant);
  const pad = (n: number, width = 2) => String(n).padStart(width, "0");
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}T${pad(at.getHours())}:${pad(at.getMinutes())}:${pad(at.getSeconds())}.${pad(at.getMilliseconds(), 3)}`;
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
