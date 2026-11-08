import {
  compareEvents,
  readEvent,
  tableChanges,
  tableDefinitions,
  tableNames,
  type EventMeta,
  type TableChange,
  type TableName,
  type WeftEvent,
} from "@weft/core";
import type { Database, SqlExecutor, SqlValue } from "./database.ts";

export interface EventLog {
  /**
   * Adds events to the log and applies them to the tables, all in one
   * transaction. An event whose ID is already in the log is skipped, so
   * appending the same event again stores it once. Resolves to the events that
   * were new.
   */
  append(events: readonly WeftEvent[]): Promise<WeftEvent[]>;
  /** Every event in the log, in the order they apply (`compareEvents`). */
  read(): Promise<WeftEvent[]>;
  rebuildTables(): Promise<void>;
}

/** `entryThreads` is `entry_threads` in SQL. */
export function sqlName(name: string): string {
  return name.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function quote(name: string): string {
  return `"${sqlName(name)}"`;
}

const LOG_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY NOT NULL,
    device_id TEXT NOT NULL,
    hlc TEXT NOT NULL,
    type TEXT NOT NULL,
    version INTEGER NOT NULL,
    content TEXT NOT NULL
  ) STRICT`,
  `CREATE INDEX IF NOT EXISTS events_in_order ON events (hlc, device_id, id)`,
  // The log is the truth (ADR 0002): nothing in it is ever updated or erased.
  `CREATE TRIGGER IF NOT EXISTS events_are_never_updated BEFORE UPDATE ON events
    BEGIN SELECT RAISE(ABORT, 'The event log is append-only: an event is never updated.'); END`,
  `CREATE TRIGGER IF NOT EXISTS events_are_never_deleted BEFORE DELETE ON events
    BEGIN SELECT RAISE(ABORT, 'The event log is append-only: an event is never deleted.'); END`,
  // INSERT OR REPLACE deletes without firing delete triggers, so an event
  // whose ID is already in the log is skipped before it gets that far.
  `CREATE TRIGGER IF NOT EXISTS events_are_never_replaced BEFORE INSERT ON events
    WHEN EXISTS (SELECT 1 FROM events WHERE id = NEW.id)
    BEGIN SELECT RAISE(IGNORE); END`,
  // The tables built from the log, so a table no longer defined is dropped too.
  `CREATE TABLE IF NOT EXISTS built_tables (name TEXT PRIMARY KEY NOT NULL) STRICT`,
];

const IN_ORDER = "ORDER BY hlc, device_id, id";

function createTable(name: TableName): string {
  const { columns, key } = tableDefinitions[name];
  const names = Object.keys(columns).map(quote);
  return `CREATE TABLE ${quote(name)} (${names.join(", ")}, PRIMARY KEY (${key.map(quote).join(", ")}))`;
}

function toSql(value: unknown): SqlValue {
  if (typeof value === "boolean") return value ? 1 : 0;
  return value as SqlValue;
}

function whereClause(where: object): { sql: string; args: SqlValue[] } {
  const entries = Object.entries(where);
  return {
    sql: entries.map(([column]) => `${quote(column)} = ?`).join(" AND "),
    args: entries.map(([, value]) => toSql(value)),
  };
}

async function applyChange(tx: SqlExecutor, change: TableChange) {
  const table = quote(change.table);
  if (change.kind === "put") {
    const entries = Object.entries(change.row);
    await tx.execute(
      `INSERT OR REPLACE INTO ${table} (${entries.map(([column]) => quote(column)).join(", ")}) VALUES (${entries.map(() => "?").join(", ")})`,
      entries.map(([, value]) => toSql(value)),
    );
  } else if (change.kind === "update") {
    const set = Object.entries(change.set);
    const where = whereClause(change.where);
    await tx.execute(
      `UPDATE ${table} SET ${set.map(([column]) => `${quote(column)} = ?`).join(", ")} WHERE ${where.sql}`,
      [...set.map(([, value]) => toSql(value)), ...where.args],
    );
  } else {
    const where = whereClause(change.where);
    await tx.execute(`DELETE FROM ${table} WHERE ${where.sql}`, where.args);
  }
}

async function applyEvent(tx: SqlExecutor, event: WeftEvent) {
  for (const change of tableChanges(event)) await applyChange(tx, change);
}

async function readLog(sql: SqlExecutor): Promise<WeftEvent[]> {
  const { rows } = await sql.execute(
    `SELECT id, device_id, hlc, type, version, content FROM events ${IN_ORDER}`,
  );
  return rows.map((row) =>
    readEvent({
      id: row.id,
      deviceId: row.device_id,
      hlc: row.hlc,
      type: row.type,
      version: row.version,
      content: JSON.parse(String(row.content)),
    }),
  );
}

async function latestEvent(tx: SqlExecutor): Promise<EventMeta | null> {
  const { rows } = await tx.execute(
    `SELECT id, device_id, hlc FROM events ORDER BY hlc DESC, device_id DESC, id DESC LIMIT 1`,
  );
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    deviceId: row.device_id,
    hlc: row.hlc,
  } as unknown as EventMeta;
}

async function rebuild(tx: SqlExecutor) {
  const built = await tx.execute(`SELECT name FROM built_tables`);
  const stale = new Set([
    ...built.rows.map((row) => String(row.name)),
    ...tableNames.map(sqlName),
  ]);
  for (const name of stale) await tx.execute(`DROP TABLE IF EXISTS "${name}"`);
  await tx.execute(`DELETE FROM built_tables`);
  for (const name of tableNames) {
    await tx.execute(createTable(name));
    await tx.execute(`INSERT INTO built_tables (name) VALUES (?)`, [
      sqlName(name),
    ]);
  }
  for (const event of await readLog(tx)) await applyEvent(tx, event);
}

/**
 * Whether the built tables are exactly the ones `tableDefinitions` gives now,
 * each as SQLite holds it: SQLite keeps a table's CREATE statement, and
 * rewrites it when the table is altered.
 */
async function tablesAreCurrent(tx: SqlExecutor): Promise<boolean> {
  const { rows } = await tx.execute(
    `SELECT b.name, m.sql FROM built_tables b
      LEFT JOIN sqlite_master m ON m.type = 'table' AND m.name = b.name`,
  );
  const current = new Map(
    tableNames.map((name) => [sqlName(name), createTable(name)]),
  );
  return (
    rows.length === current.size &&
    rows.every((row) => current.get(String(row.name)) === row.sql)
  );
}

/**
 * Opens the event log in `database`, creating it if it is new. Tables missing
 * or built to an older shape are rebuilt from the log.
 */
export async function openEventLog(database: Database): Promise<EventLog> {
  // The seam takes one transaction at a time (`Database.transaction`).
  let queue: Promise<unknown> = Promise.resolve();
  function exclusive<T>(work: (tx: SqlExecutor) => Promise<T>): Promise<T> {
    const result = queue.then(() => database.transaction(work));
    queue = result.catch(() => {});
    return result;
  }

  await exclusive(async (tx) => {
    for (const statement of LOG_SCHEMA) await tx.execute(statement);
    if (!(await tablesAreCurrent(tx))) await rebuild(tx);
  });

  return {
    async append(events) {
      // Checked before anything is written: the log keeps only events that fit.
      const incoming = events
        .map((event) => readEvent(event))
        .sort(compareEvents);
      return exclusive(async (tx) => {
        let latest = await latestEvent(tx);
        let inOrder = true;
        const appended: WeftEvent[] = [];
        for (const event of incoming) {
          const { rowsAffected } = await tx.execute(
            `INSERT INTO events (id, device_id, hlc, type, version, content)
              VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (id) DO NOTHING`,
            [
              event.id,
              event.deviceId,
              event.hlc,
              event.type,
              event.version,
              JSON.stringify(event.content),
            ],
          );
          if (rowsAffected === 0) continue;
          appended.push(event);
          // An event older than one already applied (from another device)
          // changes what later events built on, so the tables are rebuilt.
          if (latest !== null && compareEvents(event, latest) < 0)
            inOrder = false;
          if (inOrder) {
            await applyEvent(tx, event);
            latest = event;
          }
        }
        if (!inOrder) await rebuild(tx);
        return appended;
      });
    },
    read() {
      return readLog(database);
    },
    rebuildTables() {
      return exclusive(rebuild);
    },
  };
}
