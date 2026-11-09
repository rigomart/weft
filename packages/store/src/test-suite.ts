import { afterEach, describe, expect, test } from "bun:test";
import {
  calendarDay,
  createEventWriter,
  EventShapeError,
  instant,
  makeId,
  tableDefinitions,
  tableNames,
  timeOfDay,
  type EventWriter,
  type WeftEvent,
} from "@weft/core";
import type { Database, SqlExecutor, SqlRow } from "./database.ts";
import { openDeviceId } from "./device.ts";
import { openEventLog, sqlName } from "./event-log.ts";

const NOV_8 = Date.UTC(2026, 10, 8, 20, 55, 55, 123);

/** A device whose clock moves a second per event, with repeatable IDs. */
function device(seed: number, startMs = NOV_8): EventWriter {
  let counter = seed * 1_000_000;
  const randomBytes = (length: number) => {
    const bytes = new Uint8Array(length);
    let rest = counter++;
    for (let i = length - 1; i >= 0; i--) {
      bytes[i] = rest % 256;
      rest = Math.floor(rest / 256);
    }
    return bytes;
  };
  let ms = startMs;
  return createEventWriter({
    deviceId: makeId(startMs, randomBytes),
    now: () => (ms += 1000),
    randomBytes,
    lastHlc: null,
  });
}

/** A few days of one person's Entries and Threads, using every event type. */
function someEvents(writer: EventWriter): WeftEvent[] {
  const back = writer.newId("entry");
  const chair = writer.newId("entry");
  const physio = writer.newId("entry");
  const stray = writer.newId("entry");
  const thread = writer.newId("thread");
  const weekly = {
    day: calendarDay("2026-11-15"),
    time: timeOfDay("09:30"),
    repeat: { kind: "weekly", weekdays: [0, 3] },
  } as const;
  const writtenAt = instant("2026-11-08T20:55:55.123Z");
  return [
    writer.write("entry written", {
      entryId: back,
      body: "Back stiff after the drive",
      writtenAt,
      parentEntryId: null,
    }),
    writer.write("entry written", {
      entryId: chair,
      body: "Desk chair?",
      writtenAt,
      parentEntryId: null,
    }),
    writer.write("entry written", {
      entryId: stray,
      body: "Wrong window",
      writtenAt,
      parentEntryId: null,
    }),
    writer.write("thread started", { threadId: thread, name: "Back" }),
    writer.write("entry put on thread", { entryId: back, threadId: thread }),
    writer.write("entry put on thread", { entryId: chair, threadId: thread }),
    writer.write("entry put on thread", { entryId: stray, threadId: thread }),
    writer.write("entry taken off thread", {
      entryId: chair,
      threadId: thread,
    }),
    writer.write("entry written", {
      entryId: physio,
      body: "Physio says stretch twice a day",
      writtenAt,
      parentEntryId: back,
    }),
    writer.write("entry edited", { entryId: back, body: "Back stiff again" }),
    writer.write("follow-up date set", { entryId: back, followUpDate: weekly }),
    writer.write("follow-up date completed", {
      entryId: back,
      completedAt: instant("2026-11-15T10:02:00.000Z"),
      completed: weekly,
      next: { ...weekly, day: calendarDay("2026-11-18") },
    }),
    writer.write("follow-up date set", {
      entryId: chair,
      followUpDate: {
        day: calendarDay("2026-11-20"),
        time: null,
        repeat: null,
      },
    }),
    writer.write("follow-up date cleared", { entryId: chair }),
    writer.write("entry put away", { entryId: chair }),
    writer.write("entry brought back", { entryId: chair }),
    writer.write("entry put away", { entryId: physio }),
    writer.write("entry deleted", { entryId: stray }),
    writer.write("thread renamed", { threadId: thread, name: "Lower back" }),
    writer.write("thread resolved", {
      threadId: thread,
      resolvedAt: instant("2026-12-01T08:00:00.000Z"),
    }),
    writer.write("thread reopened", { threadId: thread }),
    writer.write("thread resolved", {
      threadId: thread,
      resolvedAt: instant("2026-12-09T08:00:00.000Z"),
    }),
  ];
}

async function dumpTables(sql: SqlExecutor) {
  const tables: Record<string, readonly SqlRow[]> = {};
  for (const name of tableNames) {
    const order = tableDefinitions[name].key.map(sqlName).join(", ");
    tables[name] = (
      await sql.execute(`SELECT * FROM "${sqlName(name)}" ORDER BY ${order}`)
    ).rows;
  }
  return tables;
}

async function count(sql: SqlExecutor, table: string): Promise<number> {
  const { rows } = await sql.execute(`SELECT count(*) AS n FROM ${table}`);
  return Number(rows[0]?.n);
}

/**
 * The tests every implementation of the database seam passes, run against a
 * new, empty database from `open` each time.
 */
export function describeStore(name: string, open: () => Promise<Database>) {
  describe(name, () => {
    const opened: Database[] = [];
    async function database() {
      const db = await open();
      opened.push(db);
      return db;
    }
    afterEach(async () => {
      for (const db of opened.splice(0)) await db.close();
    });

    describe("the database seam", () => {
      test("a transaction commits what it ran", async () => {
        const db = await database();
        await db.transaction(async (tx) => {
          await tx.execute("CREATE TABLE t (n INTEGER)");
          await tx.execute("INSERT INTO t (n) VALUES (?), (?)", [1, 2]);
        });
        expect((await db.execute("SELECT n FROM t ORDER BY n")).rows).toEqual([
          { n: 1 },
          { n: 2 },
        ]);
      });

      test("a transaction that throws rolls back and throws the same error", async () => {
        const db = await database();
        await db.execute("CREATE TABLE t (n INTEGER)");
        const failure = new Error("stop");
        const run = db.transaction(async (tx) => {
          await tx.execute("INSERT INTO t (n) VALUES (1)");
          throw failure;
        });
        await expect(run).rejects.toBe(failure);
        expect(await count(db, "t")).toBe(0);
      });

      test("values come back as they were written", async () => {
        const db = await database();
        await db.execute("CREATE TABLE t (s TEXT, n INTEGER, r REAL, z TEXT)");
        await db.execute("INSERT INTO t VALUES (?, ?, ?, ?)", [
          "Back ✓",
          42,
          1.5,
          null,
        ]);
        const result = await db.execute("SELECT * FROM t");
        expect(result.rows).toEqual([{ s: "Back ✓", n: 42, r: 1.5, z: null }]);
        expect(
          (await db.execute("UPDATE t SET n = 1 WHERE n = 42")).rowsAffected,
        ).toBe(1);
      });
    });

    describe("the device's ID", () => {
      test("is made once and kept when the tables are rebuilt", async () => {
        const db = await database();
        const first = makeId<"device">(NOV_8, () => new Uint8Array(10));
        const second = makeId<"device">(NOV_8 + 1, () => new Uint8Array(10));
        expect(await openDeviceId(db, () => first)).toBe(first);
        await (await openEventLog(db)).rebuildTables();
        expect(await openDeviceId(db, () => second)).toBe(first);
        expect(await count(db, "device")).toBe(1);
      });
    });

    describe("the event log", () => {
      test("gives back what was appended, in order", async () => {
        const log = await openEventLog(await database());
        const events = someEvents(device(1));
        expect(await log.append(events)).toEqual(events);
        expect(await log.read()).toEqual(events);
      });

      test("dropping every table and rebuilding from the log gives the same tables", async () => {
        const db = await database();
        const log = await openEventLog(db);
        await log.append(someEvents(device(1)));
        const before = await dumpTables(db);
        expect(before.entries).toHaveLength(4);
        expect(before.threads).toEqual([
          expect.objectContaining({
            name: "Lower back",
            resolved_at: "2026-12-09T08:00:00.000Z",
          }),
        ]);
        expect(before.entryThreads).toHaveLength(2);

        for (const name of tableNames) {
          await db.execute(`DROP TABLE "${sqlName(name)}"`);
        }
        await log.rebuildTables();

        expect(await dumpTables(db)).toEqual(before);
      });

      test("appending the same event twice leaves one copy", async () => {
        const db = await database();
        const log = await openEventLog(db);
        const events = someEvents(device(1));
        await log.append(events);
        const tables = await dumpTables(db);

        expect(await log.append([events[0]!, events[0]!])).toEqual([]);
        expect(await log.append(events)).toEqual([]);

        expect(await count(db, "events")).toBe(events.length);
        expect(await dumpTables(db)).toEqual(tables);
      });

      test("a repeat within one append is stored once", async () => {
        const db = await database();
        const log = await openEventLog(db);
        const [first] = someEvents(device(1));
        expect(await log.append([first!, first!])).toEqual([first!]);
        expect(await count(db, "events")).toBe(1);
      });

      test("events appended out of order build the same tables as in order", async () => {
        const events = someEvents(device(1));
        const inOrder = await database();
        await (await openEventLog(inOrder)).append(events);

        const outOfOrder = await database();
        const log = await openEventLog(outOfOrder);
        for (const event of [...events].reverse()) await log.append([event]);

        expect(await dumpTables(outOfOrder)).toEqual(await dumpTables(inOrder));
        expect(await log.read()).toEqual(events);
      });

      test("an event and its table changes commit together or not at all", async () => {
        const db = await database();
        const log = await openEventLog(db);
        const [first, ...rest] = someEvents(device(1));
        await log.append([first!]);
        const tables = await dumpTables(db);

        const failing: Database = {
          execute: (sql, args) => db.execute(sql, args),
          transaction: (work) =>
            db.transaction((tx) =>
              work({
                execute(sql, args) {
                  if (sql.startsWith(`INSERT OR REPLACE INTO "threads"`)) {
                    throw new Error("disk full");
                  }
                  return tx.execute(sql, args);
                },
              }),
            ),
          close: () => db.close(),
        };
        const failingLog = await openEventLog(failing);
        await expect(failingLog.append(rest)).rejects.toThrow("disk full");

        expect(await log.read()).toEqual([first!]);
        expect(await dumpTables(db)).toEqual(tables);
      });

      test("an event is never updated or deleted", async () => {
        const db = await database();
        const log = await openEventLog(db);
        const events = someEvents(device(1));
        await log.append(events);

        await expect(
          db.execute("UPDATE events SET type = 'entry edited'"),
        ).rejects.toThrow("append-only");
        await expect(db.execute("DELETE FROM events")).rejects.toThrow(
          "append-only",
        );
        await db.execute(
          `INSERT OR REPLACE INTO events (id, device_id, hlc, type, version, content)
            SELECT id, device_id, hlc, type, version, '{}' FROM events`,
        );

        expect(await log.read()).toEqual(events);
      });

      test("an event that does not fit is refused before anything is written", async () => {
        const db = await database();
        const log = await openEventLog(db);
        const [first, second] = someEvents(device(1));
        const broken = { ...second!, content: { body: "" } } as WeftEvent;
        await expect(log.append([first!, broken])).rejects.toThrow(
          EventShapeError,
        );
        expect(await count(db, "events")).toBe(0);
      });

      test("opening rebuilds tables built to an older shape", async () => {
        const db = await database();
        await (await openEventLog(db)).append(someEvents(device(1)));
        const tables = await dumpTables(db);

        await db.execute(`DROP TABLE threads`);
        await db.execute(`CREATE TABLE threads (thread_id, title)`);
        await db.execute(`CREATE TABLE old_entries (entry_id)`);
        await db.execute(
          `INSERT INTO built_tables (name) VALUES ('old_entries')`,
        );

        await openEventLog(db);

        expect(await dumpTables(db)).toEqual(tables);
        const { rows } = await db.execute(
          `SELECT name FROM sqlite_master WHERE name = 'old_entries'`,
        );
        expect(rows).toEqual([]);
      });

      test("opening rebuilds a table that was altered", async () => {
        const db = await database();
        await (await openEventLog(db)).append(someEvents(device(1)));
        const tables = await dumpTables(db);
        await db.execute(`ALTER TABLE entries RENAME COLUMN body TO title`);

        await openEventLog(db);

        expect(await dumpTables(db)).toEqual(tables);
      });

      test("opening rebuilds a table that is missing", async () => {
        const db = await database();
        await (await openEventLog(db)).append(someEvents(device(1)));
        const tables = await dumpTables(db);
        await db.execute(`DROP TABLE entry_threads`);

        await openEventLog(db);

        expect(await dumpTables(db)).toEqual(tables);
      });

      test("events from two devices build the same tables in either arrival order", async () => {
        const mine = someEvents(device(1));
        const theirs = someEvents(device(2, NOV_8 + 500));
        const a = await database();
        const logA = await openEventLog(a);
        await logA.append(mine);
        await logA.append(theirs);
        const b = await database();
        const logB = await openEventLog(b);
        await logB.append(theirs);
        await logB.append(mine);

        expect(await dumpTables(b)).toEqual(await dumpTables(a));
        expect(await logB.read()).toEqual(await logA.read());
      });
    });
  });
}
