import type {
  EntryId,
  EventId,
  FollowUpDate,
  Instant,
  TableName,
  ThreadId,
} from "@weft/core";

/**
 * The one way the interface reaches Weft (ADR 0010). Each client implements
 * it: in-process over `store`, over IPC on desktop, and later in a browser.
 * Every implementation passes the contract suite (`@weft/contracts/suite`).
 */
export interface Weft {
  /**
   * Runs a command. Resolves once its event and the tables built from it are
   * committed. Rejects with a `WeftError` and stores nothing when the command
   * is refused.
   *
   * Running a command again with the same `eventId` stores nothing new and
   * resolves, whatever else the command says: the event it named is already
   * in the log. So a client that is unsure whether a command went through
   * sends the same command again.
   */
  run(command: Command): Promise<void>;
  read<Q extends Query>(query: Q): Promise<QueryResult<Q>>;
  /**
   * Calls `listener` after each command that stored an event, in the order
   * they were stored, naming the tables it changed. A command that stored
   * nothing calls it not at all. Returns a function that stops the calls.
   */
  subscribe(listener: (change: TablesChanged) => void): () => void;
}

/**
 * Each command writes one event. `eventId` is that event's ID, made by the
 * client (ADR 0002), and the IDs of new Entries and Threads are made there
 * too, so a command sent twice is the same command.
 */
export type Command =
  | {
      readonly type: "write entry";
      readonly eventId: EventId;
      readonly entryId: EntryId;
      readonly body: string;
      /** Set to make the Entry an Update to that Entry. */
      readonly parentEntryId: EntryId | null;
    }
  | {
      readonly type: "edit entry";
      readonly eventId: EventId;
      readonly entryId: EntryId;
      readonly body: string;
    }
  | EntryCommand<"delete entry">
  | EntryCommand<"put entry away">
  | EntryCommand<"bring entry back">
  /** Naming an Update puts its first Entry on the Thread, or takes it off. */
  | EntryThreadCommand<"put entry on thread">
  | EntryThreadCommand<"take entry off thread">
  | {
      readonly type: "set follow-up date";
      readonly eventId: EventId;
      readonly entryId: EntryId;
      readonly followUpDate: FollowUpDate;
    }
  | EntryCommand<"clear follow-up date">
  /** Says the Entry's Follow-up date has been dealt with. The Entry stays, as a record. */
  | EntryCommand<"complete follow-up date">
  | NamedThreadCommand<"start thread">
  | NamedThreadCommand<"rename thread">
  | ThreadCommand<"resolve thread">
  | ThreadCommand<"reopen thread">;

interface EntryCommand<T extends string> {
  readonly type: T;
  readonly eventId: EventId;
  readonly entryId: EntryId;
}

interface ThreadCommand<T extends string> {
  readonly type: T;
  readonly eventId: EventId;
  readonly threadId: ThreadId;
}

interface EntryThreadCommand<T extends string> extends EntryCommand<T> {
  readonly threadId: ThreadId;
}

interface NamedThreadCommand<T extends string> extends ThreadCommand<T> {
  readonly name: string;
}

export type CommandType = Command["type"];

export type Query = { readonly type: "entries" } | { readonly type: "threads" };

export type QueryType = Query["type"];

export interface QueryResults {
  /**
   * Every Entry not deleted, newest first: by when it was written, then by
   * `entryId`, highest first.
   */
  readonly entries: readonly EntryListItem[];
  /** Every Thread, by `threadId`, which sorts by when it was made. */
  readonly threads: readonly ThreadListItem[];
}

export type QueryResult<Q extends Query> = QueryResults[Q["type"]];

export interface EntryListItem {
  readonly entryId: EntryId;
  readonly body: string;
  readonly writtenAt: Instant;
  /**
   * Set when the Entry is an Update to that Entry. An Update whose Entry was
   * deleted names the Entry that one followed from, or null when it was the
   * first.
   */
  readonly parentEntryId: EntryId | null;
  readonly putAway: boolean;
  readonly followUpDate: FollowUpDate | null;
  /**
   * The Follow-up date last completed, and when, until a Follow-up date is
   * set or cleared. Setting it again undoes the completion.
   */
  readonly completed: {
    readonly at: Instant;
    readonly followUpDate: FollowUpDate;
  } | null;
  /**
   * The Threads the Entry is on, by `threadId`. An Update is on its first
   * Entry's Threads, and keeps them when that Entry is deleted.
   */
  readonly threadIds: readonly ThreadId[];
}

export interface ThreadListItem {
  readonly threadId: ThreadId;
  readonly name: string;
  /** Null while the Thread is open. */
  readonly resolvedAt: Instant | null;
}

export interface TablesChanged {
  /** In the order `tableNames` gives them. */
  readonly tables: readonly TableName[];
}
