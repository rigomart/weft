/**
 * A hybrid logical clock timestamp: the UTC millisecond and a counter, as
 * `2026-11-08T20:55:55.123Z-0000`. It is fixed width, so comparing two as
 * strings orders them. Two devices can make the same one; events break that
 * tie by device ID (`compareEvents`).
 */
export type Hlc = string & { readonly __brand: "Hlc" };

export interface HlcParts {
  readonly ms: number;
  readonly counter: number;
}

const HLC = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)-([0-9a-f]{4})$/;
const MAX_COUNTER = 0xffff;
const MAX_MS = Date.UTC(9999, 11, 31, 23, 59, 59, 999);

export function formatHlc({ ms, counter }: HlcParts): Hlc {
  if (!Number.isSafeInteger(ms) || ms < 0 || ms > MAX_MS) {
    throw new RangeError(
      `A clock time must be a millisecond from year 1970 to 9999, got ${ms}.`,
    );
  }
  if (!Number.isInteger(counter) || counter < 0 || counter > MAX_COUNTER) {
    throw new RangeError(
      `A clock counter must be from 0 to ${MAX_COUNTER}, got ${counter}.`,
    );
  }
  return `${new Date(ms).toISOString()}-${counter.toString(16).padStart(4, "0")}` as Hlc;
}

export function parseHlc(value: string): HlcParts {
  const match = HLC.exec(value);
  const ms = match ? Date.parse(match[1]!) : Number.NaN;
  if (!match || Number.isNaN(ms) || new Date(ms).toISOString() !== match[1]) {
    throw new SyntaxError(`Not a clock timestamp: ${JSON.stringify(value)}.`);
  }
  return { ms, counter: Number.parseInt(match[2]!, 16) };
}

export function isHlc(value: unknown): value is Hlc {
  if (typeof value !== "string") return false;
  try {
    parseHlc(value);
    return true;
  } catch {
    return false;
  }
}

/** The timestamp for the next event this device writes, always after `last`, even when the wall clock went back. */
export function tickHlc(last: HlcParts | null, now: number): HlcParts {
  if (last === null || now > last.ms) return { ms: now, counter: 0 };
  return { ms: last.ms, counter: next(last.counter) };
}

/** This device's clock after seeing a timestamp from another device: after both, and after `now`. */
export function receiveHlc(
  last: HlcParts | null,
  remote: HlcParts,
  now: number,
): HlcParts {
  const local = last ?? { ms: -1, counter: 0 };
  const ms = Math.max(local.ms, remote.ms, now);
  if (ms === local.ms && ms === remote.ms) {
    return { ms, counter: next(Math.max(local.counter, remote.counter)) };
  }
  if (ms === local.ms) return { ms, counter: next(local.counter) };
  if (ms === remote.ms) return { ms, counter: next(remote.counter) };
  return { ms, counter: 0 };
}

function next(counter: number): number {
  if (counter >= MAX_COUNTER) {
    throw new RangeError(
      `More than ${MAX_COUNTER + 1} events in one millisecond.`,
    );
  }
  return counter + 1;
}
