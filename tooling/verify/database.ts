import { Database } from "bun:sqlite";
import { existsSync, statSync } from "node:fs";

import { instancePaths, verifyCommand, VerifyError } from "./instance.ts";

/** One statement; a trailing semicolon is fine. Writes fail anyway, since the file opens read-only. */
export function checkQuery(sql: string): string {
  const statement = sql.trim().replace(/;\s*$/, "");
  if (!statement || statement.includes(";")) {
    throw new VerifyError(
      "db takes exactly one statement",
      `pass one SELECT or PRAGMA, such as: bun run verify db "PRAGMA schema_version"`,
    );
  }
  if (!/^(select|with|pragma|explain)\b/i.test(statement)) {
    throw new VerifyError(
      `db only reads: ${statement}`,
      "pass one SELECT, WITH, PRAGMA or EXPLAIN statement",
    );
  }
  return statement;
}

/**
 * Reads the instance's `weft.db` whether or not its Weft is running. `file` says which file it read,
 * so two reads on either side of a relaunch show whether it is the same file.
 */
export function queryDatabase(name: string, sql: string) {
  const statement = checkQuery(sql);
  const { database } = instancePaths(name);
  if (!existsSync(database)) {
    throw new VerifyError(
      `instance "${name}" has no database at ${database}`,
      `Weft creates it on its first launch: run ${verifyCommand(name, "up")}`,
    );
  }
  const stats = statSync(database);
  const db = new Database(database, { readonly: true });
  try {
    db.run("PRAGMA query_only = ON");
    const rows = db.query(statement).all();
    return {
      database,
      file: {
        inode: stats.ino,
        createdAt: stats.birthtime.toISOString(),
        bytes: stats.size,
      },
      rows,
    };
  } catch (error) {
    throw new VerifyError(
      `the query failed: ${error instanceof Error ? error.message : String(error)}`,
      "check the statement; the tables come with the event log, so a fresh database has none",
    );
  } finally {
    db.close();
  }
}
