import {
  createClient,
  type Client,
  type ResultSet,
  type Transaction,
  type Value,
} from "@libsql/client";
import { pathToFileURL } from "node:url";
import type {
  Database,
  SqlExecutor,
  SqlResult,
  SqlRow,
  SqlValue,
} from "@weft/store";

function toSqlValue(value: Value, column: string): SqlValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number"
  ) {
    return value;
  }
  throw new TypeError(
    `Column ${column} holds a ${typeof value === "bigint" ? "64-bit integer" : "blob"}, which the database seam does not carry.`,
  );
}

function toResult(result: ResultSet): SqlResult {
  return {
    rows: result.rows.map((row): SqlRow =>
      Object.fromEntries(
        result.columns.map((column, index) => [
          column,
          toSqlValue(row[index] as Value, column),
        ]),
      ),
    ),
    rowsAffected: result.rowsAffected,
  };
}

function executor(target: Client | Transaction): SqlExecutor {
  return {
    async execute(sql, args = []) {
      return toResult(await target.execute({ sql, args: [...args] }));
    },
  };
}

/**
 * The database seam on `@libsql/client`, for hosts that run Node (ADR 0005).
 * Opens the SQLite file at `path`, creating it if it is missing.
 */
export function openLibsqlDatabase(path: string): Database {
  const client = createClient({ url: pathToFileURL(path).href });
  return {
    ...executor(client),
    async transaction(work) {
      const tx = await client.transaction("write");
      try {
        const result = await work(executor(tx));
        await tx.commit();
        return result;
      } finally {
        // libsql rolls back a transaction closed before it commits.
        tx.close();
      }
    },
    async close() {
      client.close();
    },
  };
}
