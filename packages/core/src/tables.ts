import type { CalendarDay, Instant, TimeOfDay } from "./dates.ts";
import type { WeftEvent } from "./events.ts";
import type { FollowUpDate } from "./follow-up-date.ts";
import type { EntryId, ThreadId } from "./ids.ts";

/**
 * The tables the views read, built from the event log. They hold no truth of
 * their own: any of them can be dropped and rebuilt by replaying the log
 * (ADR 0002), so changing a shape here costs a rebuild, not a migration.
 */
export interface Tables {
  entries: EntryRow;
  threads: ThreadRow;
  entryThreads: EntryThreadRow;
}

export type TableName = keyof Tables;

export interface EntryRow {
  readonly entryId: EntryId;
  readonly body: string;
  readonly writtenAt: Instant;
  /** Set when the Entry is an Update to that Entry. */
  readonly parentEntryId: EntryId | null;
  readonly putAway: boolean;
  /**
   * A deleted Entry keeps its row, so its Updates can still be read as
   * following from what it followed from, and on its Threads.
   */
  readonly deleted: boolean;
  readonly followUpDay: CalendarDay | null;
  readonly followUpTime: TimeOfDay | null;
  /** The Follow-up date's Repeat, as JSON. */
  readonly followUpRepeat: string | null;
  /** When the Follow-up date was last completed, until one is set or cleared. */
  readonly completedAt: Instant | null;
  /** The Follow-up date completed then, as JSON. */
  readonly completed: string | null;
}

export interface ThreadRow {
  readonly threadId: ThreadId;
  readonly name: string;
  /** Null while the Thread is open. */
  readonly resolvedAt: Instant | null;
}

export interface EntryThreadRow {
  readonly entryId: EntryId;
  readonly threadId: ThreadId;
}

type Columns<Row> = { readonly [K in keyof Row]-?: true };

export interface TableDefinition<Row> {
  readonly columns: Columns<Row>;
  readonly key: readonly (keyof Row & string)[];
}

export const tableDefinitions: {
  readonly [T in TableName]: TableDefinition<Tables[T]>;
} = {
  entries: {
    columns: {
      entryId: true,
      body: true,
      writtenAt: true,
      parentEntryId: true,
      putAway: true,
      deleted: true,
      followUpDay: true,
      followUpTime: true,
      followUpRepeat: true,
      completedAt: true,
      completed: true,
    },
    key: ["entryId"],
  },
  threads: {
    columns: { threadId: true, name: true, resolvedAt: true },
    key: ["threadId"],
  },
  entryThreads: {
    columns: { entryId: true, threadId: true },
    key: ["entryId", "threadId"],
  },
};

export const tableNames = Object.keys(tableDefinitions) as TableName[];

/** One write to one table, made by an event. */
export type TableChange = {
  [T in TableName]:
    | {
        /** Adds the row, or replaces the one with the same key. */
        readonly kind: "put";
        readonly table: T;
        readonly row: Tables[T];
      }
    | {
        /** Changes `set` in every row matching `where`, if there is one. */
        readonly kind: "update";
        readonly table: T;
        readonly where: Partial<Tables[T]>;
        readonly set: Partial<Tables[T]>;
      }
    | {
        /** Removes every row matching `where`. */
        readonly kind: "delete";
        readonly table: T;
        readonly where: Partial<Tables[T]>;
      };
}[TableName];

/**
 * What an event changes in the tables. Events apply in `compareEvents` order,
 * so a later change to a field wins (ADR 0002). Each change reads nothing, so
 * applying an event never depends on the tables or on the day it runs.
 */
export function tableChanges(event: WeftEvent): TableChange[] {
  switch (event.type) {
    case "entry written": {
      const { entryId, body, writtenAt, parentEntryId } = event.content;
      return [
        {
          kind: "put",
          table: "entries",
          row: {
            entryId,
            body,
            writtenAt,
            parentEntryId,
            putAway: false,
            deleted: false,
            ...followUpColumns(null),
            ...completionColumns(null),
          },
        },
      ];
    }
    case "entry edited":
      return [updateEntry(event.content.entryId, { body: event.content.body })];
    case "entry deleted":
      return [updateEntry(event.content.entryId, { deleted: true })];
    case "entry put away":
      return [updateEntry(event.content.entryId, { putAway: true })];
    case "entry brought back":
      return [updateEntry(event.content.entryId, { putAway: false })];
    case "entry put on thread":
      return [{ kind: "put", table: "entryThreads", row: event.content }];
    case "entry taken off thread":
      return [{ kind: "delete", table: "entryThreads", where: event.content }];
    case "follow-up date set":
      return [
        updateEntry(event.content.entryId, {
          ...followUpColumns(event.content.followUpDate),
          ...completionColumns(null),
        }),
      ];
    case "follow-up date cleared":
      return [
        updateEntry(event.content.entryId, {
          ...followUpColumns(null),
          ...completionColumns(null),
        }),
      ];
    case "follow-up date completed":
      return [
        updateEntry(event.content.entryId, {
          ...followUpColumns(event.content.next),
          ...completionColumns(event.content),
        }),
      ];
    case "thread started": {
      const { threadId, name } = event.content;
      return [
        {
          kind: "put",
          table: "threads",
          row: { threadId, name, resolvedAt: null },
        },
      ];
    }
    case "thread renamed":
      return [
        updateThread(event.content.threadId, { name: event.content.name }),
      ];
    case "thread resolved":
      return [
        updateThread(event.content.threadId, {
          resolvedAt: event.content.resolvedAt,
        }),
      ];
    case "thread reopened":
      return [updateThread(event.content.threadId, { resolvedAt: null })];
    default: {
      const unknown: never = event;
      throw new Error(`No table rule for ${JSON.stringify(unknown)}.`);
    }
  }
}

function updateEntry(entryId: EntryId, set: Partial<EntryRow>): TableChange {
  return { kind: "update", table: "entries", where: { entryId }, set };
}

function updateThread(
  threadId: ThreadId,
  set: Partial<ThreadRow>,
): TableChange {
  return { kind: "update", table: "threads", where: { threadId }, set };
}

function followUpColumns(
  date: FollowUpDate | null,
): Pick<EntryRow, "followUpDay" | "followUpTime" | "followUpRepeat"> {
  return {
    followUpDay: date?.day ?? null,
    followUpTime: date?.time ?? null,
    followUpRepeat: date?.repeat ? JSON.stringify(date.repeat) : null,
  };
}

function completionColumns(
  completion: { completedAt: Instant; completed: FollowUpDate } | null,
): Pick<EntryRow, "completedAt" | "completed"> {
  return {
    completedAt: completion?.completedAt ?? null,
    completed: completion ? JSON.stringify(completion.completed) : null,
  };
}
