import { afterAll, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describeStore } from "@weft/store/test-suite";
import { openLibsqlDatabase } from "./index.ts";

const folder = mkdtempSync(join(tmpdir(), "weft store "));
afterAll(() => rmSync(folder, { recursive: true, force: true }));

let files = 0;
describeStore("@libsql/client", async () =>
  openLibsqlDatabase(join(folder, `weft-${files++}.db`)),
);

test("opens the file at the path given, whatever characters it has", async () => {
  const names = ["a#b.db", "a?b.db", "a%20b.db", "Wéft ✓.db"];
  for (const name of names) {
    const database = openLibsqlDatabase(join(folder, name));
    await database.execute("CREATE TABLE t (n INTEGER)");
    await database.close();
    expect(existsSync(join(folder, name))).toBe(true);
  }
  expect(readdirSync(folder)).toEqual(expect.arrayContaining(names));
  expect(readdirSync(folder)).not.toContain("a b.db");
});
