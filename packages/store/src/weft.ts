import {
  createEvent,
  formatHlc,
  instantFromMs,
  localCalendarDay,
  nextFollowUpDate,
  parseHlc,
  tableChanges,
  tableNames,
  tickHlc,
  type CalendarDay,
  type DeviceId,
  type EntryId,
  type EventMeta,
  type FollowUpDate,
  type HlcParts,
  type Instant,
  type Repeat,
  type ThreadId,
  type TimeOfDay,
  type WeftEvent,
} from "@weft/core";
import {
  readCommand,
  readQuery,
  WeftError,
  type Command,
  type EntryListItem,
  type QueryResult,
  type TablesChanged,
  type ThreadListItem,
  type Weft,
} from "@weft/contracts";
import type { Database, SqlExecutor, SqlRow } from "./database.ts";
import { openEventLog } from "./event-log.ts";

export interface InProcessWeftOptions {
  readonly database: Database;
  readonly deviceId: DeviceId;
  /** The wall clock, in milliseconds since 1970 UTC. */
  readonly now: () => number;
}

/**
 * The contract (ADR 0010) implemented in the same process as `store`: the
 * desktop's main process serves it over IPC, and a phone app would call it
 * directly. Opens the event log in `database`, as `openEventLog` does.
 *
 * It must be the only writer to that log while it is open: it keeps the
 * latest clock timestamp and runs its checks without looking for events
 * appended by anything else.
 */
export async function openWeft(options: InProcessWeftOptions): Promise<Weft> {
  const { database, deviceId, now } = options;
  const log = await openEventLog(database);
  const latest = await log.latest();
  let lastHlc: HlcParts | null = latest ? parseHlc(latest.hlc) : null;
  const listeners = new Set<(change: TablesChanged) => void>();

  let queue: Promise<unknown> = Promise.resolve();
  function exclusive<T>(work: () => Promise<T>): Promise<T> {
    const result = queue.then(work);
    queue = result.catch(() => {});
    return result;
  }

  function notify(event: WeftEvent) {
    const changed = new Set(tableChanges(event).map((change) => change.table));
    const change = { tables: tableNames.filter((name) => changed.has(name)) };
    for (const listener of listeners) {
      try {
        listener(change);
      } catch (error) {
        reportAsUnhandled(error);
      }
    }
  }

  return {
    async run(input) {
      const command = readCommand(input);
      await exclusive(async () => {
        if (await log.has(command.eventId)) return;
        await check(database, command);
        const ms = now();
        const hlc = tickHlc(lastHlc, ms);
        const meta = { id: command.eventId, deviceId, hlc: formatHlc(hlc) };
        const event =
          command.type === "complete follow-up date"
            ? completion(
                meta,
                command.entryId,
                (await followUpDateOf(database, command.entryId))!,
                ms,
              )
            : eventFor(
                await onFirstEntry(database, command),
                meta,
                instantFromMs(ms),
              );
        await log.append([event]);
        lastHlc = hlc;
        notify(event);
      });
    },
    async read(input) {
      const query = readQuery(input);
      const result = await exclusive<readonly unknown[]>(() =>
        query.type === "entries"
          ? readEntries(database)
          : readThreads(database),
      );
      return result as unknown as QueryResult<typeof input>;
    },
    subscribe(listener) {
      const subscription = (change: TablesChanged) => listener(change);
      listeners.add(subscription);
      return () => listeners.delete(subscription);
    },
  };
}

/**
 * Putting an Update on a Thread, or taking it off one, puts its first Entry
 * on it or takes it off: an Update has no Threads of its own (ADR 0001).
 */
async function onFirstEntry<C extends Command>(
  sql: SqlExecutor,
  command: C,
): Promise<C> {
  if (
    command.type !== "put entry on thread" &&
    command.type !== "take entry off thread"
  ) {
    return command;
  }
  return {
    ...command,
    entryId: firstEntryOf(command.entryId, await readLinks(sql)),
  };
}

function reportAsUnhandled(error: unknown) {
  void Promise.reject(error);
}

function completion(
  meta: EventMeta,
  entryId: EntryId,
  completed: FollowUpDate,
  ms: number,
): WeftEvent {
  return createEvent(meta, "follow-up date completed", {
    entryId,
    completedAt: instantFromMs(ms),
    completed,
    next: nextFollowUpDate(completed, localCalendarDay(ms)),
  });
}

function eventFor(
  command: Exclude<Command, { type: "complete follow-up date" }>,
  meta: EventMeta,
  at: Instant,
): WeftEvent {
  switch (command.type) {
    case "write entry": {
      const { entryId, body, parentEntryId } = command;
      return createEvent(meta, "entry written", {
        entryId,
        body,
        writtenAt: at,
        parentEntryId,
      });
    }
    case "edit entry":
      return createEvent(meta, "entry edited", {
        entryId: command.entryId,
        body: command.body,
      });
    case "delete entry":
      return createEvent(meta, "entry deleted", { entryId: command.entryId });
    case "put entry away":
      return createEvent(meta, "entry put away", { entryId: command.entryId });
    case "bring entry back":
      return createEvent(meta, "entry brought back", {
        entryId: command.entryId,
      });
    case "put entry on thread":
    case "take entry off thread":
      return createEvent(
        meta,
        command.type === "put entry on thread"
          ? "entry put on thread"
          : "entry taken off thread",
        { entryId: command.entryId, threadId: command.threadId },
      );
    case "set follow-up date":
      return createEvent(meta, "follow-up date set", {
        entryId: command.entryId,
        followUpDate: command.followUpDate,
      });
    case "clear follow-up date":
      return createEvent(meta, "follow-up date cleared", {
        entryId: command.entryId,
      });
    case "start thread":
      return createEvent(meta, "thread started", {
        threadId: command.threadId,
        name: command.name,
      });
    case "rename thread":
      return createEvent(meta, "thread renamed", {
        threadId: command.threadId,
        name: command.name,
      });
    case "resolve thread":
      return createEvent(meta, "thread resolved", {
        threadId: command.threadId,
        resolvedAt: at,
      });
    case "reopen thread":
      return createEvent(meta, "thread reopened", {
        threadId: command.threadId,
      });
    default: {
      const unknown: never = command;
      throw new Error(`No event for ${JSON.stringify(unknown)}.`);
    }
  }
}

async function check(sql: SqlExecutor, command: Command) {
  switch (command.type) {
    case "write entry":
      if (
        await entryExists(sql, command.entryId, { counting: "deleted too" })
      ) {
        throw new WeftError(
          "already exists",
          `Entry ${command.entryId} already exists.`,
        );
      }
      if (command.parentEntryId !== null) {
        await requireEntry(sql, command.parentEntryId);
      }
      return;
    case "start thread":
      if (await threadExists(sql, command.threadId)) {
        throw new WeftError(
          "already exists",
          `Thread ${command.threadId} already exists.`,
        );
      }
      return;
    case "put entry on thread":
    case "take entry off thread":
      await requireEntry(sql, command.entryId);
      await requireThread(sql, command.threadId);
      return;
    case "rename thread":
    case "resolve thread":
    case "reopen thread":
      await requireThread(sql, command.threadId);
      return;
    case "complete follow-up date":
      await requireEntry(sql, command.entryId);
      if ((await followUpDateOf(sql, command.entryId)) === null) {
        throw new WeftError(
          "not found",
          `Entry ${command.entryId} has no Follow-up date.`,
        );
      }
      return;
    default:
      await requireEntry(sql, command.entryId);
  }
}

/** A deleted Entry's ID stays taken, but nothing can change the Entry. */
async function entryExists(
  sql: SqlExecutor,
  entryId: EntryId,
  { counting }: { counting: "live" | "deleted too" } = { counting: "live" },
) {
  const { rows } = await sql.execute(
    counting === "live"
      ? `SELECT 1 FROM entries WHERE entry_id = ? AND deleted = 0`
      : `SELECT 1 FROM entries WHERE entry_id = ?`,
    [entryId],
  );
  return rows.length > 0;
}

async function threadExists(sql: SqlExecutor, threadId: ThreadId) {
  const { rows } = await sql.execute(
    `SELECT 1 FROM threads WHERE thread_id = ?`,
    [threadId],
  );
  return rows.length > 0;
}

async function requireEntry(sql: SqlExecutor, entryId: EntryId) {
  if (!(await entryExists(sql, entryId))) {
    throw new WeftError("not found", `No Entry ${entryId}.`);
  }
}

async function requireThread(sql: SqlExecutor, threadId: ThreadId) {
  if (!(await threadExists(sql, threadId))) {
    throw new WeftError("not found", `No Thread ${threadId}.`);
  }
}

async function readEntries(sql: SqlExecutor): Promise<EntryListItem[]> {
  const onThreads = await sql.execute(
    `SELECT entry_id, thread_id FROM entry_threads ORDER BY thread_id`,
  );
  const threadIds = new Map<string, ThreadId[]>();
  for (const row of onThreads.rows) {
    const entryId = String(row.entry_id);
    threadIds.set(entryId, [
      ...(threadIds.get(entryId) ?? []),
      row.thread_id as ThreadId,
    ]);
  }
  const links = await readLinks(sql);
  const { rows } = await sql.execute(
    `SELECT entry_id, body, written_at, parent_entry_id, put_away,
        follow_up_day, follow_up_time, follow_up_repeat, completed_at, completed
      FROM entries WHERE deleted = 0
      ORDER BY written_at DESC, entry_id DESC`,
  );
  return rows.map((row) => ({
    entryId: row.entry_id as EntryId,
    body: String(row.body),
    writtenAt: row.written_at as Instant,
    parentEntryId: liveParent(row.parent_entry_id as EntryId | null, links),
    putAway: row.put_away === 1,
    followUpDate: followUpDateFromRow(row),
    completed:
      row.completed_at === null
        ? null
        : {
            at: row.completed_at as Instant,
            followUpDate: JSON.parse(String(row.completed)) as FollowUpDate,
          },
    threadIds:
      threadIds.get(firstEntryOf(row.entry_id as EntryId, links)) ?? [],
  }));
}

/** Each Entry's parent, and whether it is deleted, deleted Entries included. */
type Links = ReadonlyMap<
  EntryId,
  { readonly parent: EntryId | null; readonly deleted: boolean }
>;

async function readLinks(sql: SqlExecutor): Promise<Links> {
  const { rows } = await sql.execute(
    `SELECT entry_id, parent_entry_id, deleted FROM entries`,
  );
  return new Map(
    rows.map((row) => [
      row.entry_id as EntryId,
      {
        parent: row.parent_entry_id as EntryId | null,
        deleted: row.deleted === 1,
      },
    ]),
  );
}

/**
 * An Update whose Entry was deleted follows from what that Entry followed
 * from, or from nothing when it was the first.
 */
function liveParent(parent: EntryId | null, links: Links): EntryId | null {
  const seen = new Set<EntryId>();
  while (parent !== null && links.get(parent)?.deleted) {
    if (seen.has(parent)) return null;
    seen.add(parent);
    parent = links.get(parent)!.parent;
  }
  return parent;
}

/**
 * The first Entry of the chain of Updates `entryId` is in, deleted or not.
 * An Update is on its first Entry's Threads (ADR 0001), and they stay its
 * Threads when that Entry is deleted.
 */
function firstEntryOf(entryId: EntryId, links: Links): EntryId {
  const seen = new Set<EntryId>([entryId]);
  let current = entryId;
  for (;;) {
    const parent = links.get(current)?.parent ?? null;
    if (parent === null || !links.has(parent) || seen.has(parent)) {
      return current;
    }
    seen.add(parent);
    current = parent;
  }
}

async function followUpDateOf(
  sql: SqlExecutor,
  entryId: EntryId,
): Promise<FollowUpDate | null> {
  const { rows } = await sql.execute(
    `SELECT follow_up_day, follow_up_time, follow_up_repeat
      FROM entries WHERE entry_id = ?`,
    [entryId],
  );
  return rows[0] ? followUpDateFromRow(rows[0]) : null;
}

function followUpDateFromRow(row: SqlRow): FollowUpDate | null {
  if (row.follow_up_day === null) return null;
  return {
    day: row.follow_up_day as CalendarDay,
    time: row.follow_up_time as TimeOfDay | null,
    repeat:
      row.follow_up_repeat === null
        ? null
        : (JSON.parse(String(row.follow_up_repeat)) as Repeat),
  };
}

async function readThreads(sql: SqlExecutor): Promise<ThreadListItem[]> {
  const { rows } = await sql.execute(
    `SELECT thread_id, name, resolved_at FROM threads ORDER BY thread_id`,
  );
  return rows.map((row) => ({
    threadId: row.thread_id as ThreadId,
    name: String(row.name),
    resolvedAt: row.resolved_at as Instant | null,
  }));
}
