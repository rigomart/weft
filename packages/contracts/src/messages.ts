import { followUpDate, tableNames, type TableName } from "@weft/core";
import {
  EventShapeError,
  id,
  instant,
  literal,
  nullable,
  record,
  text,
  type Reader,
} from "@weft/core/shape";
import type {
  Command,
  CommandType,
  EntryListItem,
  Query,
  QueryResult,
  QueryResults,
  QueryType,
  TablesChanged,
  ThreadListItem,
} from "./contract.ts";
import { WeftError, weftErrorCodes, type WeftErrorCode } from "./errors.ts";

// Each reader throws a `WeftError` with code "invalid" when the message does not fit.

const eventId = id<"event">();
const entryId = id<"entry">();
const threadId = id<"thread">();

const boolean: Reader<boolean> = (value, path) => {
  if (typeof value !== "boolean") {
    throw new EventShapeError(path, "is not true or false");
  }
  return value;
};

function list<T>(read: Reader<T>): Reader<readonly T[]> {
  return (value, path) => {
    if (!Array.isArray(value)) throw new EventShapeError(path, "is not a list");
    return value.map((item: unknown, index) => read(item, `${path}[${index}]`));
  };
}

function oneOf<const T extends string>(values: readonly T[]): Reader<T> {
  return (value, path) => {
    if (!values.includes(value as T)) {
      throw new EventShapeError(
        path,
        `is not one of ${values.map((v) => JSON.stringify(v)).join(", ")}`,
      );
    }
    return value as T;
  };
}

function byType<T extends { readonly type: string }>(readers: {
  readonly [K in T["type"]]: Reader<Extract<T, { readonly type: K }>>;
}): Reader<T> {
  return (value, path) => {
    const type =
      typeof value === "object" && value !== null
        ? (value as { type?: unknown }).type
        : undefined;
    if (typeof type !== "string" || !Object.hasOwn(readers, type)) {
      throw new EventShapeError(
        `${path}.type`,
        `is not one of ${Object.keys(readers)
          .map((key) => JSON.stringify(key))
          .join(", ")}`,
      );
    }
    return (readers as Record<string, Reader<T>>)[type]!(value, path);
  };
}

function entryCommand<const T extends CommandType>(type: T) {
  return record({ type: literal(type), eventId, entryId });
}

function threadCommand<const T extends CommandType>(type: T) {
  return record({ type: literal(type), eventId, threadId });
}

function onThread<const T extends CommandType>(type: T) {
  return record({ type: literal(type), eventId, entryId, threadId });
}

function named<const T extends CommandType>(type: T) {
  return record({ type: literal(type), eventId, threadId, name: text });
}

const command = byType<Command>({
  "write entry": record({
    type: literal("write entry"),
    eventId,
    entryId,
    body: text,
    parentEntryId: nullable(entryId),
  }),
  "edit entry": record({
    type: literal("edit entry"),
    eventId,
    entryId,
    body: text,
  }),
  "delete entry": entryCommand("delete entry"),
  "put entry away": entryCommand("put entry away"),
  "bring entry back": entryCommand("bring entry back"),
  "put entry on thread": onThread("put entry on thread"),
  "take entry off thread": onThread("take entry off thread"),
  "set follow-up date": record({
    type: literal("set follow-up date"),
    eventId,
    entryId,
    followUpDate,
  }),
  "clear follow-up date": entryCommand("clear follow-up date"),
  "complete follow-up date": entryCommand("complete follow-up date"),
  "start thread": named("start thread"),
  "rename thread": named("rename thread"),
  "resolve thread": threadCommand("resolve thread"),
  "reopen thread": threadCommand("reopen thread"),
});

const query = byType<Query>({
  entries: record({ type: literal("entries") }),
  threads: record({ type: literal("threads") }),
});

const entryListItem: Reader<EntryListItem> = record({
  entryId,
  body: text,
  writtenAt: instant,
  parentEntryId: nullable(entryId),
  putAway: boolean,
  followUpDate: nullable(followUpDate),
  threadIds: list(threadId),
});

const threadListItem: Reader<ThreadListItem> = record({
  threadId,
  name: text,
  resolvedAt: nullable(instant),
});

const queryResults: { readonly [Q in QueryType]: Reader<QueryResults[Q]> } = {
  entries: list(entryListItem),
  threads: list(threadListItem),
};

const tablesChanged: Reader<TablesChanged> = record({
  tables: list(oneOf<TableName>(tableNames)),
});

const weftErrorMessage = record({
  code: oneOf<WeftErrorCode>(weftErrorCodes),
  message: text,
});

function refusingInvalid<T>(read: Reader<T>, path: string) {
  return (value: unknown): T => {
    try {
      return read(value, path);
    } catch (error) {
      if (error instanceof EventShapeError) {
        throw new WeftError("invalid", error.message);
      }
      throw error;
    }
  };
}

export const readCommand = refusingInvalid(command, "command");

export const readQuery = refusingInvalid(query, "query");

export function readQueryResult<Q extends Query>(
  query: Q,
  value: unknown,
): QueryResult<Q> {
  const read = queryResults[query.type] as Reader<QueryResult<Q>>;
  return refusingInvalid(read, query.type)(value);
}

export const readTablesChanged = refusingInvalid(tablesChanged, "change");

export function readWeftError(value: unknown): WeftError {
  const { code, message } = refusingInvalid(weftErrorMessage, "error")(value);
  return new WeftError(code, message);
}
