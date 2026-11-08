import { createClient, type Client } from "@libsql/client";
import { pathToFileURL } from "node:url";

export type Database = { client: Client; path: string; sqliteVersion: string };

/**
 * Fails at launch if libsql's native binding is missing or broken. The tables come with the event
 * log (#29).
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
