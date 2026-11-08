import {
  createEvent,
  type CurrentVersion,
  type EventContent,
  type EventEnvelope,
  type EventType,
} from "./events.ts";
import {
  formatHlc,
  parseHlc,
  receiveHlc,
  tickHlc,
  type Hlc,
  type HlcParts,
} from "./hlc.ts";
import { makeId, type DeviceId, type Id, type RandomBytes } from "./ids.ts";

export interface EventWriterOptions {
  readonly deviceId: DeviceId;
  /** The wall clock, in milliseconds since 1970 UTC. */
  readonly now: () => number;
  readonly randomBytes: RandomBytes;
  /** The latest clock timestamp this device has written or seen, so new events come after it. */
  readonly lastHlc: Hlc | null;
}

export interface EventWriter {
  write<T extends EventType>(
    type: T,
    content: EventContent<T>,
  ): EventEnvelope<T, CurrentVersion<T>>;
  /** An ID for a new Entry or Thread. */
  newId<Kind extends "entry" | "thread">(kind: Kind): Id<Kind>;
  /** Moves this device's clock past a timestamp seen on another device's event. */
  receive(hlc: Hlc): void;
}

/** Writes this device's events, each with a new ID and a clock timestamp after the last. */
export function createEventWriter(options: EventWriterOptions): EventWriter {
  const { deviceId, now, randomBytes } = options;
  let last: HlcParts | null =
    options.lastHlc === null ? null : parseHlc(options.lastHlc);

  return {
    write(type, content) {
      const next = tickHlc(last, now());
      const event = createEvent(
        { id: makeId(next.ms, randomBytes), deviceId, hlc: formatHlc(next) },
        type,
        content,
      );
      last = next;
      return event;
    },
    newId(_kind) {
      return makeId(now(), randomBytes);
    },
    receive(hlc) {
      last = receiveHlc(last, parseHlc(hlc), now());
    },
  };
}
