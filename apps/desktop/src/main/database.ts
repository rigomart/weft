import { makeId, type Weft } from "@weft/contracts";
import { openLibsqlDatabase } from "@weft/database-libsql";
import { openDeviceId, openWeft, type Database } from "@weft/store";

export type OpenedWeft = {
  weft: Weft;
  database: Database;
  path: string;
  sqliteVersion: string;
};

const randomBytes = (length: number) =>
  crypto.getRandomValues(new Uint8Array(length));

/**
 * Opens the event log in the SQLite file at `path`, creating it if it is new. Fails at launch if
 * libsql's native binding is missing or broken.
 */
export async function openWeftAt(path: string): Promise<OpenedWeft> {
  const database = openLibsqlDatabase(path);
  try {
    const { rows } = await database.execute(
      "SELECT sqlite_version() AS version",
    );
    const deviceId = await openDeviceId(database, () =>
      makeId(Date.now(), randomBytes),
    );
    const weft = await openWeft({ database, deviceId, now: Date.now });
    return { weft, database, path, sqliteVersion: String(rows[0]?.version) };
  } catch (error) {
    await database.close();
    throw error;
  }
}
