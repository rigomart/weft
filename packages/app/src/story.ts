import type { EntryId, EntryListItem } from "@weft/contracts";

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
