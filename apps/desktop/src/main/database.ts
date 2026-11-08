import { createClient, type Client } from "@libsql/client";
import { pathToFileURL } from "node:url";

export type Database = { client: Client; path: string; sqliteVersion: string };

/**
 * Opens (or creates) the SQLite file through libsql and runs one query, so a missing or broken native
 * binding fails here, at launch. The tables come with the event log (#29).
 */
export async function openDatabase(path: string): Promise<Database> {
  const client = createClient({ url: pathToFileURL(path).href });
  try {
    const result = await client.execute("SELECT sqlite_version() AS version");
    return { client, path, sqliteVersion: String(result.rows[0]?.version) };
  } catch (error) {
    client.close();
    throw error;
  }
}
