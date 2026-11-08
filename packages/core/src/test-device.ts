import type { Hlc } from "./hlc.ts";
import { makeId, type DeviceId, type RandomBytes } from "./ids.ts";
import { createEventWriter, type EventWriter } from "./writer.ts";

export function seededRandom(seed: number): RandomBytes {
  let state = seed >>> 0 || 1;
  return (length) => {
    const bytes = new Uint8Array(length);
    for (let i = 0; i < length; i++) {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      bytes[i] = state & 0xff;
    }
    return bytes;
  };
}

/** A device for tests, with a clock the test sets. */
export function testDevice(
  seed: number,
  startMs: number,
  lastHlc: Hlc | null = null,
) {
  const clock = { ms: startMs };
  const randomBytes = seededRandom(seed);
  const deviceId = makeId<"device">(startMs, randomBytes);
  const writer: EventWriter = createEventWriter({
    deviceId,
    now: () => clock.ms,
    randomBytes,
    lastHlc,
  });
  return { deviceId: deviceId as DeviceId, clock, writer };
}
