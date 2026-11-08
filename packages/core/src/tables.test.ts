import { describe, expect, test } from "bun:test";
import { calendarDay, instant, timeOfDay } from "./dates.ts";
import type { WeftEvent } from "./events.ts";
import {
  tableChanges,
  tableDefinitions,
  tableNames,
  type TableChange,
  type TableName,
  type Tables,
} from "./tables.ts";
import { testDevice } from "./test-device.ts";

const NOV_8 = Date.UTC(2026, 10, 8, 20, 55, 55, 123);
const WRITTEN = instant("2026-11-08T20:55:55.123Z");

type Rows = { [T in TableName]: Tables[T][] };

function matches(row: object, where: object): boolean {
  return Object.entries(where).every(
    ([column, value]) =>
      (row as unknown as Record<string, unknown>)[column] === value,
  );
}

function build(events: WeftEvent[]): Rows {
  const rows: Record<string, object[]> = Object.fromEntries(
    tableNames.map((name) => [name, []]),
  );
  for (const change of events.flatMap(tableChanges) as TableChange[]) {
    const table = rows[change.table]!;
    if (change.kind === "put") {
      const key = Object.fromEntries(
        tableDefinitions[change.table].key.map((column) => [
          column,
          (change.row as unknown as Record<string, unknown>)[column],
        ]),
      );
      rows[change.table] = [
        ...table.filter((row) => !matches(row, key)),
        change.row,
      ];
    } else if (change.kind === "update") {
      rows[change.table] = table.map((row) =>
        matches(row, change.where) ? { ...row, ...change.set } : row,
      );
    } else {
      rows[change.table] = table.filter((row) => !matches(row, change.where));
    }
  }
  return rows as Rows;
}

function device() {
  const { writer } = testDevice(7, NOV_8);
  const entry = writer.newId("entry");
  const thread = writer.newId("thread");
  const written = writer.write("entry written", {
    entryId: entry,
    body: "Back stiff after the drive",
    writtenAt: WRITTEN,
    parentEntryId: null,
  });
  return { writer, entry, thread, written };
}

describe("tableChanges", () => {
  test("an Entry starts with no Follow-up date, not put away", () => {
    const { written, entry } = device();
    expect(build([written]).entries).toEqual([
      {
        entryId: entry,
        body: "Back stiff after the drive",
        writtenAt: WRITTEN,
        parentEntryId: null,
        putAway: false,
        followUpDay: null,
        followUpTime: null,
        followUpRepeat: null,
      },
    ]);
  });

  test("an Update keeps the Entry it follows", () => {
    const { writer, written, entry } = device();
    const update = writer.write("entry written", {
      entryId: writer.newId("entry"),
      body: "Physio says stretch twice a day",
      writtenAt: WRITTEN,
      parentEntryId: entry,
    });
    expect(
      build([written, update]).entries.map((row) => row.parentEntryId),
    ).toEqual([null, entry]);
  });

  test("editing, putting away and bringing back change only their columns", () => {
    const { writer, written, entry } = device();
    const events: WeftEvent[] = [
      written,
      writer.write("entry edited", { entryId: entry, body: "Back better" }),
      writer.write("entry put away", { entryId: entry }),
    ];
    expect(build(events).entries[0]).toMatchObject({
      body: "Back better",
      writtenAt: WRITTEN,
      putAway: true,
    });
    events.push(writer.write("entry brought back", { entryId: entry }));
    expect(build(events).entries[0]?.putAway).toBe(false);
  });

  test("a Follow-up date is set, moved on by completing it, and cleared", () => {
    const { writer, written, entry } = device();
    const weekly = {
      day: calendarDay("2026-11-15"),
      time: timeOfDay("09:30"),
      repeat: { kind: "weekly", weekdays: [0, 3] },
    } as const;
    const events: WeftEvent[] = [
      written,
      writer.write("follow-up date set", {
        entryId: entry,
        followUpDate: weekly,
      }),
    ];
    expect(build(events).entries[0]).toMatchObject({
      followUpDay: "2026-11-15",
      followUpTime: "09:30",
      followUpRepeat: '{"kind":"weekly","weekdays":[0,3]}',
    });

    events.push(
      writer.write("follow-up date completed", {
        entryId: entry,
        completedAt: instant("2026-11-15T10:02:00.000Z"),
        completed: weekly,
        next: { ...weekly, day: calendarDay("2026-11-18") },
      }),
    );
    expect(build(events).entries[0]?.followUpDay).toBe(
      calendarDay("2026-11-18"),
    );

    events.push(
      writer.write("follow-up date completed", {
        entryId: entry,
        completedAt: instant("2026-11-18T10:02:00.000Z"),
        completed: { day: calendarDay("2026-11-18"), time: null, repeat: null },
        next: null,
      }),
    );
    expect(build(events).entries[0]).toMatchObject({
      followUpDay: null,
      followUpTime: null,
      followUpRepeat: null,
    });

    events.push(
      writer.write("follow-up date set", {
        entryId: entry,
        followUpDate: { ...weekly, time: null, repeat: null },
      }),
      writer.write("follow-up date cleared", { entryId: entry }),
    );
    expect(build(events).entries[0]?.followUpDay).toBeNull();
  });

  test("an Entry is on a Thread once, however often it is put on it", () => {
    const { writer, written, entry, thread } = device();
    const onThread = { entryId: entry, threadId: thread };
    const events: WeftEvent[] = [
      written,
      writer.write("thread started", { threadId: thread, name: "Back" }),
      writer.write("entry put on thread", onThread),
      writer.write("entry put on thread", onThread),
    ];
    expect(build(events).entryThreads).toEqual([onThread]);
    events.push(writer.write("entry taken off thread", onThread));
    expect(build(events).entryThreads).toEqual([]);
  });

  test("deleting an Entry removes it and takes it off its Threads", () => {
    const { writer, written, entry, thread } = device();
    const other = writer.write("entry written", {
      entryId: writer.newId("entry"),
      body: "Desk chair?",
      writtenAt: WRITTEN,
      parentEntryId: null,
    });
    const tables = build([
      written,
      other,
      writer.write("entry put on thread", { entryId: entry, threadId: thread }),
      writer.write("entry put on thread", {
        entryId: other.content.entryId,
        threadId: thread,
      }),
      writer.write("entry deleted", { entryId: entry }),
    ]);
    expect(tables.entries.map((row) => row.entryId)).toEqual([
      other.content.entryId,
    ]);
    expect(tables.entryThreads).toEqual([
      { entryId: other.content.entryId, threadId: thread },
    ]);
  });

  test("a Thread is renamed, resolved and reopened", () => {
    const { writer, thread } = device();
    const events: WeftEvent[] = [
      writer.write("thread started", { threadId: thread, name: "Insurance" }),
      writer.write("thread renamed", {
        threadId: thread,
        name: "Car insurance",
      }),
      writer.write("thread resolved", {
        threadId: thread,
        resolvedAt: instant("2026-12-01T08:00:00.000Z"),
      }),
    ];
    expect(build(events).threads).toEqual([
      {
        threadId: thread,
        name: "Car insurance",
        resolvedAt: instant("2026-12-01T08:00:00.000Z"),
      },
    ]);
    events.push(writer.write("thread reopened", { threadId: thread }));
    expect(build(events).threads[0]?.resolvedAt).toBeNull();
  });

  test("changes to an Entry that is not there change nothing", () => {
    const { writer, entry } = device();
    expect(
      build([
        writer.write("entry edited", { entryId: entry, body: "Lost" }),
        writer.write("entry put away", { entryId: entry }),
      ]).entries,
    ).toEqual([]);
  });
});
