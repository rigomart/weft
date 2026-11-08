declare const idKind: unique symbol;

/** An ID made on a device: a UUID version 7 (RFC 9562), sortable by the millisecond it was made in. */
export type Id<Kind extends string> = string & { readonly [idKind]: Kind };

export type EventId = Id<"event">;
export type DeviceId = Id<"device">;
export type EntryId = Id<"entry">;
export type ThreadId = Id<"thread">;

/** Random bytes from the host's crypto seam (ADR 0005). */
export type RandomBytes = (length: number) => Uint8Array;

const UUID_V7 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const MAX_MS = 2 ** 48 - 1;

export function makeId<Kind extends string>(
  ms: number,
  randomBytes: RandomBytes,
): Id<Kind> {
  if (!Number.isSafeInteger(ms) || ms < 0 || ms > MAX_MS) {
    throw new RangeError(
      `An ID's time must be a millisecond from 0 to 2^48 - 1, got ${ms}.`,
    );
  }
  const random = randomBytes(10);
  if (random.length !== 10) {
    throw new RangeError(`An ID needs 10 random bytes, got ${random.length}.`);
  }

  const bytes = new Uint8Array(16);
  let rest = ms;
  for (let i = 5; i >= 0; i--) {
    bytes[i] = rest % 256;
    rest = Math.floor(rest / 256);
  }
  bytes[6] = 0x70 | (random[0]! & 0x0f);
  bytes[7] = random[1]!;
  bytes[8] = 0x80 | (random[2]! & 0x3f);
  bytes.set(random.subarray(3), 9);

  const hex = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}` as Id<Kind>;
}

export function isId(value: unknown): value is Id<string> {
  return typeof value === "string" && UUID_V7.test(value);
}

export function idTime(id: Id<string>): number {
  return Number.parseInt(id.slice(0, 8) + id.slice(9, 13), 16);
}
