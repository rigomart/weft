import { afterAll, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { calendarDay, makeId, timeOfDay } from "@weft/contracts";
import { describeContract } from "@weft/contracts/suite";
import { openEventLog, openWeft } from "@weft/store";
import { openLibsqlDatabase } from "./index.ts";

const folder = mkdtempSync(join(tmpdir(), "weft contract "));
afterAll(() => rmSync(folder, { recursive: true, force: true }));

const randomBytes = (length: number) =>
  crypto.getRandomValues(new Uint8Array(length));

let files = 0;
describeContract("in-process over @libsql/client", async () => {
  const database = openLibsqlDatabase(join(folder, `weft-${files++}.db`));
  const weft = await openWeft({
    database,
    deviceId: makeId(Date.now(), randomBytes),
    now: Date.now,
  });
  return { weft, close: () => database.close() };
});

test("events keep their order when the wall clock goes back, and after reopening", async () => {
  const path = join(folder, "clock.db");
  const deviceId = makeId<"device">(Date.now(), randomBytes);
  const clock = [5_000, 4_000, 3_000];
  const writes: string[] = [];
  async function writeAt(ms: number) {
    const database = openLibsqlDatabase(path);
    const weft = await openWeft({ database, deviceId, now: () => ms });
    const eventId = makeId<"event">(Date.now(), randomBytes);
    writes.push(eventId);
    await weft.run({
      type: "write entry",
      eventId,
      entryId: makeId(Date.now(), randomBytes),
      body: `Written at ${ms}`,
      parentEntryId: null,
    });
    await database.close();
  }
  for (const ms of clock) await writeAt(Date.UTC(2026, 10, 8) + ms);

  const database = openLibsqlDatabase(path);
  const events = await (await openEventLog(database)).read();
  await database.close();
  expect<string[]>(events.map((event) => event.id)).toEqual(writes);
});

test("completing stores the date that was dealt with, when, and no next date without a Repeat", async () => {
  const database = openLibsqlDatabase(join(folder, "complete.db"));
  const at = Date.UTC(2026, 10, 8, 15, 4, 5, 6);
  const weft = await openWeft({
    database,
    deviceId: makeId(Date.now(), randomBytes),
    now: () => at,
  });
  const id = <Kind extends "event" | "entry">(_kind: Kind) =>
    makeId<Kind>(Date.now(), randomBytes);
  const entryId = id("entry");
  const followUpDate = {
    day: calendarDay("2026-11-08"),
    time: timeOfDay("09:30"),
    repeat: null,
  };
  await weft.run({
    type: "write entry",
    eventId: id("event"),
    entryId,
    body: "Book the checkup",
    parentEntryId: null,
  });
  await weft.run({
    type: "set follow-up date",
    eventId: id("event"),
    entryId,
    followUpDate,
  });
  await weft.run({
    type: "complete follow-up date",
    eventId: id("event"),
    entryId,
  });

  const events = await (await openEventLog(database)).read();
  await database.close();
  expect(events.at(-1)).toMatchObject({
    type: "follow-up date completed",
    version: 1,
    content: {
      entryId,
      completedAt: "2026-11-08T15:04:05.006Z",
      completed: followUpDate,
      next: null,
    },
  });
});
