import { describe, expect, test } from "bun:test";
import { makeId } from "@weft/core";
import { WeftError, toWeftErrorMessage } from "./errors.ts";
import {
  readCommand,
  readQueryResult,
  readTablesChanged,
  readWeftError,
} from "./messages.ts";

const bytes = (length: number) => new Uint8Array(length);
const entryId = makeId<"entry">(Date.UTC(2026, 10, 8), bytes);
const threadId = makeId<"thread">(Date.UTC(2026, 10, 8), bytes);

function refusal(read: () => unknown) {
  try {
    read();
  } catch (error) {
    expect(error).toBeInstanceOf(WeftError);
    return {
      code: (error as WeftError).code,
      message: (error as Error).message,
    };
  }
  throw new Error("Expected a refusal.");
}

describe("read results", () => {
  const entry = {
    entryId,
    body: "Desk chair?",
    writtenAt: "2026-11-08T20:55:55.123Z",
    parentEntryId: null,
    putAway: false,
    followUpDate: null,
    threadIds: [threadId],
  };

  test("an Entry list that fits is given back as it was", () => {
    expect<unknown>(readQueryResult({ type: "entries" }, [entry])).toEqual([
      entry,
    ]);
  });

  test("an Entry list with a row that does not fit is refused", () => {
    expect(
      refusal(() =>
        readQueryResult({ type: "entries" }, [{ ...entry, putAway: 0 }]),
      ),
    ).toEqual({
      code: "invalid",
      message: "entries[0].putAway is not true or false",
    });
    expect(
      refusal(() => readQueryResult({ type: "threads" }, { threadId })),
    ).toEqual({ code: "invalid", message: "threads is not a list" });
  });
});

test("a notification names only tables that exist", () => {
  expect(readTablesChanged({ tables: ["entries", "entryThreads"] })).toEqual({
    tables: ["entries", "entryThreads"],
  });
  expect(refusal(() => readTablesChanged({ tables: ["notes"] }))).toEqual({
    code: "invalid",
    message:
      'change.tables[0] is not one of "entries", "threads", "entryThreads"',
  });
});

test("a WeftError crosses a boundary as data and comes back the same", () => {
  const error = new WeftError("not found", `No Entry ${entryId}.`);
  const back = readWeftError(
    JSON.parse(JSON.stringify(toWeftErrorMessage(error))),
  );
  expect(back).toBeInstanceOf(WeftError);
  expect(toWeftErrorMessage(back)).toEqual(toWeftErrorMessage(error));
  expect(refusal(() => readWeftError({ code: "gone", message: "x" }))).toEqual({
    code: "invalid",
    message:
      'error.code is not one of "invalid", "not found", "already exists"',
  });
});

test("a command is read into exactly its fields", () => {
  const command = {
    type: "put entry on thread",
    eventId: makeId<"event">(Date.UTC(2026, 10, 8), bytes),
    entryId,
    threadId,
  };
  expect<unknown>(readCommand(command)).toEqual(command);
});
