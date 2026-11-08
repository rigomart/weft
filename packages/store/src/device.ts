import { isId, type DeviceId } from "@weft/core";
import type { Database } from "./database.ts";

/**
 * This device's ID, carried by every event it writes (ADR 0002). It is kept in the database beside
 * the log; `newDeviceId` makes it the first time.
 */
export async function openDeviceId(
  database: Database,
  newDeviceId: () => DeviceId,
): Promise<DeviceId> {
  return database.transaction(async (tx) => {
    await tx.execute(
      `CREATE TABLE IF NOT EXISTS device (
        only_row INTEGER PRIMARY KEY NOT NULL CHECK (only_row = 1),
        id TEXT NOT NULL
      ) STRICT`,
    );
    const { rows } = await tx.execute(`SELECT id FROM device`);
    const kept = rows[0]?.id;
    if (kept !== undefined) {
      if (!isId(kept)) throw new Error(`The device's ID ${kept} is not an ID.`);
      return kept as DeviceId;
    }
    const id = newDeviceId();
    await tx.execute(`INSERT INTO device (only_row, id) VALUES (1, ?)`, [id]);
    return id;
  });
}
