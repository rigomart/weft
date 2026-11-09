import type {
  CalendarDay,
  EntryId,
  EntryListItem,
  ThreadId,
  ThreadListItem,
} from "@weft/contracts";

import { dateOf, daysFrom, repeatLabel } from "./follow-up-date.ts";
import { isPutAway } from "./glance.ts";

export const LANE_HEIGHT = 78;
/** Room above the first lane for the months and the today mark. */
export const TOP = 34;
export const LOOSE_HEIGHT = 118;
const LOOSE_ROWS = [26, 58, 90];
const MIN_DOT_SPACING = 14;
const DAY = 86_400_000;

export interface HistoryLane {
  readonly thread: ThreadListItem;
  /** The lane's centre line. */
  readonly y: number;
  /** Its solid line, from its first dot to today, or to when it was resolved. */
  readonly from: number;
  readonly to: number;
  /**
   * Where its dotted line into the future ends, at its last dot after today that is not put away;
   * null when none is, and for a resolved Thread.
   */
  readonly until: number | null;
  readonly entries: number;
  /** Its Entries with a Follow-up date, not counting put-away ones. */
  readonly asking: number;
}

export interface HistoryDot {
  readonly entry: EntryListItem;
  readonly x: number;
  /** One per lane it is on, top to bottom; one in the Loose band when it is Loose. */
  readonly ys: readonly number[];
  /** The lanes it is on, top to bottom; empty when it is Loose. */
  readonly threadIds: readonly ThreadId[];
  /** It has a Follow-up date, so it sits there as an open dot. */
  readonly asking: boolean;
  readonly late: boolean;
  /** It is put away, or an Update to an Entry that is. */
  readonly away: boolean;
  /** Its Repeat's rhythm, "every Monday", when its Follow-up date repeats. */
  readonly rhythm: string | null;
  readonly label: { readonly text: string; readonly y: number } | null;
}

export interface HistoryJoin {
  readonly from: { readonly x: number; readonly y: number };
  readonly to: { readonly x: number; readonly y: number };
}

export interface HistoryLayout {
  readonly width: number;
  readonly height: number;
  /** Where the Loose band starts. */
  readonly looseTop: number;
  readonly loose: number;
  /** Where now is. */
  readonly today: number;
  readonly months: readonly { readonly x: number; readonly label: string }[];
  readonly lanes: readonly HistoryLane[];
  readonly dots: readonly HistoryDot[];
  /** An Update joined to the Entry it follows from. */
  readonly joins: readonly HistoryJoin[];
}

/**
 * History, laid out from the Entries and Threads alone (ADR 0002): one lane per open Thread, ordered
 * by latest activity, with Threads that share Entries kept side by side, then one per resolved
 * Thread, most recently resolved first, then a band for Loose Entries. Time runs left to right over at least `width` pixels. Each Entry is a dot where it was
 * completed, else where it was written, or an open dot at its Follow-up date, on every lane it is
 * on, put away or not. Dots in one lane closer than `MIN_DOT_SPACING` are moved apart, away from today.
 */
export function historyLayout({
  entries,
  threads,
  today,
  now,
  width,
}: {
  entries: readonly EntryListItem[];
  threads: readonly ThreadListItem[];
  today: CalendarDay;
  now: number;
  width: number;
}): HistoryLayout {
  const byId = new Map(entries.map((entry) => [entry.entryId, entry]));
  const resolved = threads
    .filter((thread) => thread.resolvedAt !== null)
    .sort((a, b) => compare(b.resolvedAt!, a.resolvedAt!));
  const lanes = [
    ...laneOrder(
      threads.filter((thread) => thread.resolvedAt === null),
      entries,
    ),
    ...resolved,
  ];
  const laneOf = new Map(lanes.map((thread, i) => [thread.threadId, i]));
  const looseTop = TOP + lanes.length * LANE_HEIGHT;
  const laneY = (i: number) => TOP + i * LANE_HEIGHT + LANE_HEIGHT / 2;

  const shown = entries
    .map((entry) => ({
      entry,
      at: placedAt(entry),
      lanes: entry.threadIds
        .flatMap((threadId) => laneOf.get(threadId) ?? [])
        .sort((a, b) => a - b),
    }))
    .filter(({ entry, lanes }) => !awaitingItsThreads(entry, lanes))
    .sort((a, b) => a.at - b.at);

  const times = [
    ...shown.map((dot) => dot.at),
    ...resolved.map((thread) => Date.parse(thread.resolvedAt!)),
  ];
  const start =
    Math.min(dateOf(today).getTime() - 30 * DAY, ...times) - 8 * DAY;
  const end = Math.max(dateOf(today).getTime() + 40 * DAY, ...times) + 12 * DAY;
  const perDay = Math.max(7, width / ((end - start) / DAY));
  const rawX = (at: number) => ((at - start) / DAY) * perDay;

  const rowEnds = LOOSE_ROWS.map(() => -Infinity);
  const rowsOf = new Map<EntryId, number[]>();
  for (const dot of shown) {
    if (dot.lanes.length > 0) {
      const first = dot.lanes[0]!;
      const last = dot.lanes[dot.lanes.length - 1]!;
      rowsOf.set(
        dot.entry.entryId,
        Array.from({ length: last - first + 1 }, (_, i) => first + i),
      );
      continue;
    }
    const x = rawX(dot.at);
    let row = rowEnds.findIndex((rowEnd) => rowEnd < x - 8);
    if (row < 0) row = rowEnds.indexOf(Math.min(...rowEnds));
    rowEnds[row] = x + Math.min(150, labelOf(dot.entry).length * 6);
    rowsOf.set(dot.entry.entryId, [lanes.length + row]);
  }

  const xs = new Map<EntryId, number>();
  const lastBeforeToday = new Map<number, number>();
  const spread = (
    side: typeof shown,
    step: number,
    reached: Map<number, number>,
  ) => {
    for (const dot of side) {
      const rows = rowsOf.get(dot.entry.entryId)!;
      let x = rawX(dot.at);
      for (const row of rows) {
        const limit = reached.get(row);
        if (limit !== undefined) {
          x = step < 0 ? Math.min(x, limit + step) : Math.max(x, limit + step);
        }
      }
      for (const row of rows) {
        reached.set(row, x);
        if (step < 0 && !lastBeforeToday.has(row)) lastBeforeToday.set(row, x);
      }
      xs.set(dot.entry.entryId, x);
    }
  };
  spread(
    shown.filter((dot) => dot.at <= now).reverse(),
    -MIN_DOT_SPACING,
    new Map(),
  );
  spread(
    shown.filter((dot) => dot.at > now),
    MIN_DOT_SPACING,
    lastBeforeToday,
  );

  const spreadXs = [...xs.values()];
  const shift = Math.max(0, 6 - Math.min(Infinity, ...spreadXs));
  const overflow = Math.max(
    0,
    Math.max(-Infinity, ...spreadXs) - (rawX(end) - 6),
  );
  for (const [entryId, x] of xs) xs.set(entryId, x + shift);
  const xOf = (at: number) => rawX(at) + shift;
  const fullWidth = Math.round(xOf(end) + overflow);
  const todayX = xOf(now);

  const rowY = (row: number) =>
    row < lanes.length
      ? laneY(row)
      : looseTop + LOOSE_ROWS[row - lanes.length]!;

  const aboveEnds = new Map<number, number>();
  const belowEnds = new Map<number, number>();
  const rowXs = new Map<number, number[]>();
  for (const [entryId, rows] of rowsOf) {
    for (const row of rows) {
      rowXs.set(row, [...(rowXs.get(row) ?? []), xs.get(entryId)!]);
    }
  }
  const clear = (row: number, x: number, end: number) =>
    !rowXs.get(row)!.some((other) => other > x + 1 && other < end + 8);
  const dots: HistoryDot[] = shown
    .map((dot) => ({ ...dot, x: xs.get(dot.entry.entryId)! }))
    .sort((a, b) => a.x - b.x)
    .map(({ entry, x, lanes: on }) => {
      const rows = rowsOf.get(entry.entryId)!;
      const ys = on.length > 0 ? on.map(laneY) : rows.map(rowY);
      const date = entry.followUpDate;
      const rhythm = date?.repeat ? repeatLabel(date.repeat) : null;
      const text = rhythm ? `↻ ${rhythm}` : labelOf(entry);
      const top = ys[0]!;
      const bottom = ys[ys.length - 1]!;
      const end = x + text.length * 5.9;
      let label: HistoryDot["label"] = null;
      if (
        x - 4 > (aboveEnds.get(top) ?? -Infinity) &&
        clear(rows[0]!, x, end)
      ) {
        label = { text, y: top - 12 - (ys.length > 1 ? 3 : 0) };
        aboveEnds.set(top, end);
      } else if (
        x - 4 > (belowEnds.get(bottom) ?? -Infinity) &&
        clear(rows[rows.length - 1]!, x, end)
      ) {
        label = { text, y: bottom + 21 };
        belowEnds.set(bottom, end);
      }
      return {
        entry,
        x,
        ys,
        threadIds: on.map((i) => lanes[i]!.threadId),
        asking: date !== null,
        late: date !== null && daysFrom(today, date.day) < 0,
        away: isPutAway(entry, byId),
        rhythm,
        label,
      };
    });

  const dotOf = new Map(dots.map((dot) => [dot.entry.entryId, dot]));
  const joins = dots.flatMap((dot) => {
    const parent =
      dot.entry.parentEntryId === null
        ? undefined
        : dotOf.get(dot.entry.parentEntryId);
    return parent
      ? [
          {
            from: { x: parent.x, y: parent.ys[0]! },
            to: { x: dot.x, y: dot.ys[0]! },
          },
        ]
      : [];
  });

  return {
    width: fullWidth,
    height: looseTop + LOOSE_HEIGHT,
    looseTop,
    loose: dots.filter((dot) => dot.threadIds.length === 0).length,
    today: todayX,
    months: monthsBetween(start, end).map((at) => ({
      x: xOf(at),
      label: new Date(at).toLocaleDateString(undefined, {
        month: "short",
        year:
          new Date(at).getFullYear() === dateOf(today).getFullYear()
            ? undefined
            : "numeric",
      }),
    })),
    lanes: lanes.map((thread, i) => {
      const on = dots.filter((dot) => dot.threadIds.includes(thread.threadId));
      const after = on
        .filter((dot) => !dot.away && dot.x > todayX)
        .map((dot) => dot.x);
      const to =
        thread.resolvedAt === null
          ? todayX
          : xOf(Date.parse(thread.resolvedAt));
      return {
        thread,
        y: laneY(i),
        from: Math.min(to, ...on.map((dot) => dot.x)),
        to,
        until:
          thread.resolvedAt === null && after.length > 0
            ? Math.max(...after)
            : null,
        entries: on.length,
        asking: on.filter((dot) => dot.asking && !dot.away).length,
      };
    }),
    dots,
    joins,
  };
}

/**
 * Most recently active first, except that each next lane is the one sharing the most Entries with
 * the lanes already placed, the lastBeforeToday counting most, so an Entry on several spans few lanes.
 */
export function laneOrder(
  threads: readonly ThreadListItem[],
  entries: readonly EntryListItem[],
): ThreadListItem[] {
  const last = new Map<ThreadId, number>();
  for (const entry of entries) {
    const at = activeAt(entry);
    for (const threadId of entry.threadIds) {
      last.set(threadId, Math.max(last.get(threadId) ?? -Infinity, at));
    }
  }
  const pending = [...threads].sort(
    (a, b) =>
      (last.get(b.threadId) ?? -Infinity) -
        (last.get(a.threadId) ?? -Infinity) ||
      (a.threadId < b.threadId ? 1 : -1),
  );
  const pairs = new Map<string, number>();
  for (const entry of entries) {
    for (const a of entry.threadIds) {
      for (const b of entry.threadIds) {
        if (a < b) pairs.set(`${a} ${b}`, (pairs.get(`${a} ${b}`) ?? 0) + 1);
      }
    }
  }
  const shared = (a: ThreadId, b: ThreadId) =>
    pairs.get(a < b ? `${a} ${b}` : `${b} ${a}`) ?? 0;
  const placed: ThreadListItem[] = [];
  while (pending.length > 0) {
    let best = 0;
    let bestScore = -1;
    pending.forEach((thread, i) => {
      const score = placed.reduce(
        (sum, other, j) =>
          sum + shared(thread.threadId, other.threadId) / (placed.length - j),
        0,
      );
      if (score > bestScore) {
        best = i;
        bestScore = score;
      }
    });
    placed.push(pending.splice(best, 1)[0]!);
  }
  return placed;
}

function placedAt(entry: EntryListItem): number {
  const date = entry.followUpDate;
  if (date === null) return activeAt(entry);
  const at = dateOf(date.day);
  if (date.time !== null) {
    const [hours, minutes] = date.time.split(":").map(Number);
    at.setHours(hours!, minutes!);
  }
  return at.getTime();
}

function awaitingItsThreads(
  entry: EntryListItem,
  lanes: readonly number[],
): boolean {
  return lanes.length === 0 && entry.threadIds.length > 0;
}

function activeAt(entry: EntryListItem): number {
  return Date.parse(entry.completed?.at ?? entry.writtenAt);
}

function labelOf(entry: EntryListItem): string {
  const text = entry.body.replace(/\s+/g, " ").trim();
  return text.length > 24 ? `${text.slice(0, 23).trimEnd()}…` : text;
}

function monthsBetween(start: number, end: number): number[] {
  const at = new Date(start);
  at.setHours(0, 0, 0, 0);
  at.setDate(1);
  at.setMonth(at.getMonth() + 1);
  const months: number[] = [];
  for (; at.getTime() < end; at.setMonth(at.getMonth() + 1)) {
    months.push(at.getTime());
  }
  return months;
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
