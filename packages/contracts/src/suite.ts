import { afterEach, describe, expect, test } from "bun:test";
import {
  calendarDay,
  localCalendarDay,
  makeId,
  nextFollowUpDate,
  timeOfDay,
  type EntryId,
  type FollowUpDate,
  type ThreadId,
} from "@weft/core";
import type {
  Command,
  Query,
  QueryResult,
  TablesChanged,
  Weft,
} from "./contract.ts";
import { WeftError, type WeftErrorCode } from "./errors.ts";
import { readQueryResult, readTablesChanged } from "./messages.ts";

export interface ContractSubject {
  /** A Weft over a new, empty event log. */
  readonly weft: Weft;
  close(): Promise<void>;
}

/** IDs a client would make, each sorting after the one before. */
function idMaker() {
  let ms = Date.now();
  let counter = 0;
  const randomBytes = (length: number) => {
    const bytes = new Uint8Array(length);
    let rest = counter++;
    for (let i = length - 1; i >= 0; i--) {
      bytes[i] = rest % 256;
      rest = Math.floor(rest / 256);
    }
    return bytes;
  };
  return <Kind extends "event" | "entry" | "thread">(_kind: Kind) =>
    makeId<Kind>(ms++, randomBytes);
}

const commandTypes = [
  "write entry",
  "edit entry",
  "delete entry",
  "put entry away",
  "bring entry back",
  "put entry on thread",
  "take entry off thread",
  "set follow-up date",
  "clear follow-up date",
  "complete follow-up date",
  "start thread",
  "rename thread",
  "resolve thread",
  "reopen thread",
]
  .map((type) => JSON.stringify(type))
  .join(", ");

function now() {
  return new Date().toISOString();
}

/**
 * The tests every implementation of the contract passes (ADR 0010), each on a
 * new subject from `open`. Every read result and notification is checked with
 * the contract's readers, as a client across a process boundary would.
 */
export function describeContract(
  name: string,
  open: () => Promise<ContractSubject>,
) {
  describe(name, () => {
    const opened: ContractSubject[] = [];
    afterEach(async () => {
      for (const subject of opened.splice(0)) await subject.close();
    });

    async function setup() {
      const subject = await open();
      opened.push(subject);
      const { weft } = subject;
      const id = idMaker();

      const changes: TablesChanged[] = [];
      const waiting: (() => void)[] = [];
      weft.subscribe((change) => {
        changes.push(readTablesChanged(change));
        for (const wake of waiting.splice(0)) wake();
      });
      async function changesUntil(count: number) {
        while (changes.length < count) {
          await new Promise<void>((resolve) => waiting.push(resolve));
        }
        return changes.map((change) => change.tables);
      }

      async function read<Q extends Query>(query: Q): Promise<QueryResult<Q>> {
        return readQueryResult(query, await weft.read(query));
      }

      async function write(body: string, parentEntryId: EntryId | null = null) {
        const entryId = id("entry");
        await weft.run({
          type: "write entry",
          eventId: id("event"),
          entryId,
          body,
          parentEntryId,
        });
        return entryId;
      }

      async function startThread(name: string) {
        const threadId = id("thread");
        await weft.run({
          type: "start thread",
          eventId: id("event"),
          threadId,
          name,
        });
        return threadId;
      }

      return { weft, id, read, write, startThread, changesUntil };
    }

    async function refused(
      run: Promise<unknown>,
      code: WeftErrorCode,
      message: string,
    ) {
      const error = await run.then(
        () => null,
        (reason: unknown) => reason,
      );
      expect(error).toBeInstanceOf(WeftError);
      const { code: actualCode, message: actualMessage } = error as WeftError;
      expect({ code: actualCode, message: actualMessage }).toEqual({
        code,
        message,
      });
    }

    test("a new Weft has no Entries and no Threads", async () => {
      const { read } = await setup();
      expect(await read({ type: "entries" })).toEqual([]);
      expect(await read({ type: "threads" })).toEqual([]);
    });

    test("writing an Entry lists it", async () => {
      const { read, write } = await setup();
      const before = now();
      const entryId = await write("Back stiff after the drive");
      const after = now();

      const [entry, ...rest] = await read({ type: "entries" });
      expect(rest).toEqual([]);
      expect(entry).toEqual({
        entryId,
        body: "Back stiff after the drive",
        writtenAt: expect.any(String),
        parentEntryId: null,
        putAway: false,
        followUpDate: null,
        threadIds: [],
      });
      expect(entry!.writtenAt >= before && entry!.writtenAt <= after).toBe(
        true,
      );
    });

    test("lists Entries newest first", async () => {
      const { read, write } = await setup();
      const first = await write("Back stiff after the drive");
      const second = await write("Desk chair?");
      const third = await write("Physio on Tuesday");

      const entries = await read({ type: "entries" });
      expect(entries.map((entry) => entry.entryId)).toEqual([
        third,
        second,
        first,
      ]);
    });

    test("lists Entries by when they were written before their IDs", async () => {
      const { weft, id, read, write } = await setup();
      const earlier = await write("Desk chair?");
      await new Promise((resolve) => setTimeout(resolve, 5));
      const laterWithLowerId = makeId<"entry">(
        Date.UTC(2020, 0, 1),
        () => new Uint8Array(10),
      );
      await weft.run({
        type: "write entry",
        eventId: id("event"),
        entryId: laterWithLowerId,
        body: "Back stiff after the drive",
        parentEntryId: null,
      });

      const entries = await read({ type: "entries" });
      expect(entries.map((entry) => entry.entryId)).toEqual([
        laterWithLowerId,
        earlier,
      ]);
    });

    test("the same command run twice stores one Entry", async () => {
      const { weft, id, read, changesUntil, startThread } = await setup();
      const command: Command = {
        type: "write entry",
        eventId: id("event"),
        entryId: id("entry"),
        body: "Desk chair?",
        parentEntryId: null,
      };
      await weft.run(command);
      await weft.run(command);
      await Promise.all([weft.run(command), weft.run(command)]);

      expect(await read({ type: "entries" })).toEqual([
        expect.objectContaining({ entryId: command.entryId }),
      ]);
      await startThread("Back");
      expect(await changesUntil(2)).toEqual([["entries"], ["threads"]]);
    });

    test("a command repeated after later commands changes nothing", async () => {
      const { weft, id, read } = await setup();
      const entryId = id("entry");
      const write: Command = {
        type: "write entry",
        eventId: id("event"),
        entryId,
        body: "Desk chair?",
        parentEntryId: null,
      };
      const edit: Command = {
        type: "edit entry",
        eventId: id("event"),
        entryId,
        body: "Desk chair, or the drive?",
      };
      await weft.run(write);
      await weft.run(edit);
      await weft.run({ type: "delete entry", eventId: id("event"), entryId });

      await weft.run(write);
      await weft.run(edit);

      expect(await read({ type: "entries" })).toEqual([]);
    });

    test("an Update lists the Entry it was added to", async () => {
      const { read, write } = await setup();
      const claim = await write("Insurance claim for the physio");
      const call = await write("Called the insurer; they want the form", claim);

      expect(await read({ type: "entries" })).toEqual([
        expect.objectContaining({ entryId: call, parentEntryId: claim }),
        expect.objectContaining({ entryId: claim, parentEntryId: null }),
      ]);
    });

    test("editing, putting away, bringing back and deleting an Entry", async () => {
      const { weft, id, read, write } = await setup();
      const back = await write("Back stiff after the drive");
      const chair = await write("Desk chair?");

      await weft.run({
        type: "edit entry",
        eventId: id("event"),
        entryId: back,
        body: "Back stiff again",
      });
      await weft.run({
        type: "put entry away",
        eventId: id("event"),
        entryId: chair,
      });
      expect(await read({ type: "entries" })).toEqual([
        expect.objectContaining({ entryId: chair, putAway: true }),
        expect.objectContaining({
          entryId: back,
          body: "Back stiff again",
          putAway: false,
        }),
      ]);

      await weft.run({
        type: "bring entry back",
        eventId: id("event"),
        entryId: chair,
      });
      await weft.run({
        type: "delete entry",
        eventId: id("event"),
        entryId: back,
      });
      expect(await read({ type: "entries" })).toEqual([
        expect.objectContaining({ entryId: chair, putAway: false }),
      ]);
    });

    test("setting, changing and clearing a Follow-up date", async () => {
      const { weft, id, read, write } = await setup();
      const back = await write("Stretch");
      const weekly: FollowUpDate = {
        day: calendarDay("2026-11-15"),
        time: timeOfDay("09:30"),
        repeat: { kind: "weekly", weekdays: [0, 3] },
      };
      const once: FollowUpDate = {
        day: calendarDay("2026-11-20"),
        time: null,
        repeat: null,
      };

      await weft.run({
        type: "set follow-up date",
        eventId: id("event"),
        entryId: back,
        followUpDate: weekly,
      });
      expect(await read({ type: "entries" })).toEqual([
        expect.objectContaining({ followUpDate: weekly }),
      ]);

      await weft.run({
        type: "set follow-up date",
        eventId: id("event"),
        entryId: back,
        followUpDate: once,
      });
      expect(await read({ type: "entries" })).toEqual([
        expect.objectContaining({ followUpDate: once }),
      ]);

      await weft.run({
        type: "clear follow-up date",
        eventId: id("event"),
        entryId: back,
      });
      expect(await read({ type: "entries" })).toEqual([
        expect.objectContaining({ followUpDate: null }),
      ]);
    });

    test("completing a Follow-up date clears it and keeps the Entry", async () => {
      const { weft, id, read, write, changesUntil } = await setup();
      const checkup = await write("Book the checkup");
      const chair = await write("Desk chair?");
      for (const entryId of [checkup, chair]) {
        await weft.run({
          type: "set follow-up date",
          eventId: id("event"),
          entryId,
          followUpDate: {
            day: calendarDay("2026-11-08"),
            time: timeOfDay("09:30"),
            repeat: null,
          },
        });
      }

      await weft.run({
        type: "complete follow-up date",
        eventId: id("event"),
        entryId: checkup,
      });

      expect(await read({ type: "entries" })).toEqual([
        expect.objectContaining({
          entryId: chair,
          followUpDate: expect.anything(),
        }),
        expect.objectContaining({
          entryId: checkup,
          body: "Book the checkup",
          putAway: false,
          followUpDate: null,
        }),
      ]);
      expect((await changesUntil(5)).at(-1)).toEqual(["entries"]);
    });

    test("completing a repeating Follow-up date moves it to its next occurrence after today", async () => {
      const { weft, id, read, write } = await setup();
      const entryId = await write("Water the plants");
      const sundays: FollowUpDate = {
        day: calendarDay("2020-01-05"),
        time: timeOfDay("08:00"),
        repeat: { kind: "weekly", weekdays: [0] },
      };
      await weft.run({
        type: "set follow-up date",
        eventId: id("event"),
        entryId,
        followUpDate: sundays,
      });

      const before = localCalendarDay(Date.now());
      await weft.run({
        type: "complete follow-up date",
        eventId: id("event"),
        entryId,
      });
      const after = localCalendarDay(Date.now());

      const [entry, ...rest] = await read({ type: "entries" });
      expect(rest).toEqual([]);
      expect([
        nextFollowUpDate(sundays, before),
        nextFollowUpDate(sundays, after),
      ]).toContainEqual(entry!.followUpDate);
      expect(entry!.followUpDate!.day > before).toBe(true);
    });

    test("refuses to complete a Follow-up date an Entry does not have", async () => {
      const { weft, id, read, write } = await setup();
      const entryId = await write("Desk chair?");
      const missing = id("entry");
      await refused(
        weft.run({
          type: "complete follow-up date",
          eventId: id("event"),
          entryId,
        }),
        "not found",
        `Entry ${entryId} has no Follow-up date.`,
      );
      await refused(
        weft.run({
          type: "complete follow-up date",
          eventId: id("event"),
          entryId: missing,
        }),
        "not found",
        `No Entry ${missing}.`,
      );

      await weft.run({
        type: "set follow-up date",
        eventId: id("event"),
        entryId,
        followUpDate: {
          day: calendarDay("2026-11-08"),
          time: null,
          repeat: null,
        },
      });
      const complete: Command = {
        type: "complete follow-up date",
        eventId: id("event"),
        entryId,
      };
      await weft.run(complete);
      await weft.run(complete);
      await refused(
        weft.run({ ...complete, eventId: id("event") }),
        "not found",
        `Entry ${entryId} has no Follow-up date.`,
      );
      expect(await read({ type: "entries" })).toEqual([
        expect.objectContaining({ entryId, followUpDate: null }),
      ]);
    });

    test("starting, renaming, resolving and reopening a Thread", async () => {
      const { weft, id, read, startThread } = await setup();
      const back = await startThread("Back");
      const insurance = await startThread("Insurance");
      expect(await read({ type: "threads" })).toEqual([
        { threadId: back, name: "Back", resolvedAt: null },
        { threadId: insurance, name: "Insurance", resolvedAt: null },
      ]);

      await weft.run({
        type: "rename thread",
        eventId: id("event"),
        threadId: back,
        name: "Lower back",
      });
      const before = now();
      await weft.run({
        type: "resolve thread",
        eventId: id("event"),
        threadId: back,
      });
      const after = now();
      const [resolved] = await read({ type: "threads" });
      expect(resolved).toEqual({
        threadId: back,
        name: "Lower back",
        resolvedAt: expect.any(String),
      });
      expect(
        resolved!.resolvedAt! >= before && resolved!.resolvedAt! <= after,
      ).toBe(true);

      await weft.run({
        type: "reopen thread",
        eventId: id("event"),
        threadId: back,
      });
      expect(await read({ type: "threads" })).toEqual([
        { threadId: back, name: "Lower back", resolvedAt: null },
        { threadId: insurance, name: "Insurance", resolvedAt: null },
      ]);
    });

    test("putting an Entry on Threads and taking it off", async () => {
      const { weft, id, read, write, startThread } = await setup();
      const entryId = await write("Physio receipt");
      const back = await startThread("Back");
      const insurance = await startThread("Insurance");
      const on = (threadId: ThreadId) =>
        weft.run({
          type: "put entry on thread",
          eventId: id("event"),
          entryId,
          threadId,
        });

      await on(insurance);
      await on(back);
      expect(await read({ type: "entries" })).toEqual([
        expect.objectContaining({ threadIds: [back, insurance] }),
      ]);

      await weft.run({
        type: "take entry off thread",
        eventId: id("event"),
        entryId,
        threadId: back,
      });
      expect(await read({ type: "entries" })).toEqual([
        expect.objectContaining({ threadIds: [insurance] }),
      ]);
    });

    test("refuses a command that does not fit, and stores nothing", async () => {
      const { weft, id, read, changesUntil, startThread } = await setup();
      const valid = {
        type: "write entry",
        eventId: id("event"),
        entryId: id("entry"),
        body: "Desk chair?",
        parentEntryId: null,
      };
      const cases: [unknown, string][] = [
        [
          { ...valid, body: "  " },
          "command.body is not text with something in it",
        ],
        [
          { ...valid, type: "file entry" },
          `command.type is not one of ${commandTypes}`,
        ],
        [{ ...valid, eventId: "1" }, "command.eventId is not an ID"],
        [
          { ...valid, writtenAt: now() },
          "command.writtenAt is not part of this shape",
        ],
        [
          {
            type: "write entry",
            eventId: valid.eventId,
            entryId: valid.entryId,
            body: "Desk chair?",
          },
          "command.parentEntryId is missing",
        ],
        [
          {
            type: "set follow-up date",
            eventId: valid.eventId,
            entryId: valid.entryId,
            followUpDate: { day: "2026-02-30", time: null, repeat: null },
          },
          "command.followUpDate.day is not a calendar day",
        ],
        [null, `command.type is not one of ${commandTypes}`],
      ];
      for (const [command, message] of cases) {
        await refused(weft.run(command as Command), "invalid", message);
      }

      expect(await read({ type: "entries" })).toEqual([]);
      await startThread("Back");
      expect(await changesUntil(1)).toEqual([["threads"]]);
    });

    test("refuses a query that does not fit", async () => {
      const { weft } = await setup();
      await refused(
        weft.read({ type: "notes" } as unknown as Query),
        "invalid",
        'query.type is not one of "entries", "threads"',
      );
    });

    test("refuses a command naming an Entry or a Thread that does not exist", async () => {
      const { weft, id, read, write } = await setup();
      const missingEntry = id("entry");
      const missingThread = id("thread");
      const entryId = await write("Desk chair?");

      await refused(
        weft.run({
          type: "write entry",
          eventId: id("event"),
          entryId: id("entry"),
          body: "Called them back",
          parentEntryId: missingEntry,
        }),
        "not found",
        `No Entry ${missingEntry}.`,
      );
      await refused(
        weft.run({
          type: "edit entry",
          eventId: id("event"),
          entryId: missingEntry,
          body: "Desk chair",
        }),
        "not found",
        `No Entry ${missingEntry}.`,
      );
      await refused(
        weft.run({
          type: "put entry on thread",
          eventId: id("event"),
          entryId,
          threadId: missingThread,
        }),
        "not found",
        `No Thread ${missingThread}.`,
      );
      await refused(
        weft.run({
          type: "resolve thread",
          eventId: id("event"),
          threadId: missingThread,
        }),
        "not found",
        `No Thread ${missingThread}.`,
      );

      expect(await read({ type: "entries" })).toEqual([
        expect.objectContaining({ entryId, threadIds: [] }),
      ]);
    });

    test("refuses an Entry or a Thread whose ID is taken", async () => {
      const { weft, id, read, write, startThread } = await setup();
      const entryId = await write("Desk chair?");
      const threadId = await startThread("Back");

      await refused(
        weft.run({
          type: "write entry",
          eventId: id("event"),
          entryId,
          body: "Something else",
          parentEntryId: null,
        }),
        "already exists",
        `Entry ${entryId} already exists.`,
      );
      await refused(
        weft.run({
          type: "start thread",
          eventId: id("event"),
          threadId,
          name: "Insurance",
        }),
        "already exists",
        `Thread ${threadId} already exists.`,
      );

      expect(await read({ type: "entries" })).toEqual([
        expect.objectContaining({ entryId, body: "Desk chair?" }),
      ]);
      expect(await read({ type: "threads" })).toEqual([
        expect.objectContaining({ threadId, name: "Back" }),
      ]);
    });

    test("a refused command can run once what it names exists", async () => {
      const { weft, id, read, write } = await setup();
      const entryId = await write("Desk chair?");
      const threadId = id("thread");
      const command: Command = {
        type: "put entry on thread",
        eventId: id("event"),
        entryId,
        threadId,
      };
      await refused(weft.run(command), "not found", `No Thread ${threadId}.`);

      await weft.run({
        type: "start thread",
        eventId: id("event"),
        threadId,
        name: "Back",
      });
      await weft.run(command);

      expect(await read({ type: "entries" })).toEqual([
        expect.objectContaining({ entryId, threadIds: [threadId] }),
      ]);
    });

    test("notifies the tables each stored command changed, in order", async () => {
      const { weft, id, write, startThread, changesUntil } = await setup();
      const entryId = await write("Physio receipt");
      const threadId = await startThread("Back");
      await weft.run({
        type: "put entry on thread",
        eventId: id("event"),
        entryId,
        threadId,
      });
      await weft.run({ type: "delete entry", eventId: id("event"), entryId });

      expect(await changesUntil(4)).toEqual([
        ["entries"],
        ["threads"],
        ["entryThreads"],
        ["entries", "entryThreads"],
      ]);
    });

    test("stops notifying a listener that unsubscribed", async () => {
      const { weft, write, changesUntil } = await setup();
      const heard: TablesChanged[] = [];
      let first: () => void;
      const firstHeard = new Promise<void>((resolve) => (first = resolve));
      const stop = weft.subscribe((change) => {
        heard.push(change);
        first();
      });
      await write("Desk chair?");
      await firstHeard;
      stop();
      await write("Back stiff");
      await changesUntil(2);

      expect(heard).toEqual([{ tables: ["entries"] }]);
    });
  });
}
