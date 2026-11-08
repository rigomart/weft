import { afterAll, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { makeId } from "@weft/contracts";
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
