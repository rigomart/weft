import type { DeviceId, EventId } from "./ids.ts";
import { followUpDate } from "./follow-up-date.ts";
import { isHlc, type Hlc } from "./hlc.ts";
import {
  EventShapeError,
  id,
  instant,
  nullable,
  record,
  text,
  type Reader,
} from "./shape.ts";

const entryId = id<"entry">();
const threadId = id<"thread">();

/**
 * Every event type and the content of each of its versions. A changed shape is
 * a new version beside the old ones, with a stored fixture for it (ADR 0002).
 *
 * "attachment added" is reserved by ADR 0007 and defined when attachments are built.
 */
const definitions = {
  "entry written": {
    current: 1,
    versions: {
      /** `parentEntryId` set makes the Entry an Update to that Entry. */
      1: record({
        entryId,
        body: text,
        writtenAt: instant,
        parentEntryId: nullable(entryId),
      }),
    },
  },
  "entry edited": {
    current: 1,
    versions: { 1: record({ entryId, body: text }) },
  },
  "entry deleted": {
    current: 1,
    versions: { 1: record({ entryId }) },
  },
  "entry put away": {
    current: 1,
    versions: { 1: record({ entryId }) },
  },
  "entry brought back": {
    current: 1,
    versions: { 1: record({ entryId }) },
  },
  "entry put on thread": {
    current: 1,
    versions: { 1: record({ entryId, threadId }) },
  },
  "entry taken off thread": {
    current: 1,
    versions: { 1: record({ entryId, threadId }) },
  },
  "follow-up date set": {
    current: 1,
    /** Sets the Entry's Follow-up date, or replaces the one it has. */
    versions: { 1: record({ entryId, followUpDate }) },
  },
  "follow-up date cleared": {
    current: 1,
    versions: { 1: record({ entryId }) },
  },
  "follow-up date completed": {
    current: 1,
    versions: {
      /**
       * `completed` is the Follow-up date that was dealt with. `next` is the
       * one the Entry has afterwards: its Repeat's next occurrence, or null.
       * The device works it out once, so rebuilding never depends on the day
       * or time zone it runs in.
       */
      1: record({
        entryId,
        completedAt: instant,
        completed: followUpDate,
        next: nullable(followUpDate),
      }),
    },
  },
  "thread started": {
    current: 1,
    versions: { 1: record({ threadId, name: text }) },
  },
  "thread renamed": {
    current: 1,
    versions: { 1: record({ threadId, name: text }) },
  },
  "thread resolved": {
    current: 1,
    versions: { 1: record({ threadId, resolvedAt: instant }) },
  },
  "thread reopened": {
    current: 1,
    versions: { 1: record({ threadId }) },
  },
} as const satisfies Record<
  string,
  { current: number; versions: Record<number, Reader<unknown>> }
>;

type Definitions = typeof definitions;

export type EventType = keyof Definitions;

export type EventVersion<T extends EventType> =
  keyof Definitions[T]["versions"] & number;

export type CurrentVersion<T extends EventType> = Definitions[T]["current"];

type ContentReader<
  T extends EventType,
  V extends EventVersion<T>,
> = Definitions[T]["versions"][V];

export type EventContent<
  T extends EventType,
  V extends EventVersion<T> = CurrentVersion<T>,
> = ContentReader<T, V> extends Reader<infer C> ? C : never;

export interface EventEnvelope<T extends EventType, V extends EventVersion<T>> {
  readonly id: EventId;
  readonly deviceId: DeviceId;
  /** Orders events across devices (`compareEvents`). */
  readonly hlc: Hlc;
  readonly type: T;
  readonly version: V;
  readonly content: EventContent<T, V>;
}

export type WeftEventOf<T extends EventType> = {
  [V in EventVersion<T>]: EventEnvelope<T, V>;
}[EventVersion<T>];

/** Any event at any version: what reading the log gives back. */
export type WeftEvent = { [T in EventType]: WeftEventOf<T> }[EventType];

export const eventTypes = Object.keys(definitions) as EventType[];

export function currentVersion<T extends EventType>(
  type: T,
): CurrentVersion<T> {
  return definitions[type].current;
}

/** Every version of `type` that can be read. */
export function eventVersions(type: EventType): number[] {
  return Object.keys(definitions[type].versions).map(Number);
}

export interface EventMeta {
  readonly id: EventId;
  readonly deviceId: DeviceId;
  readonly hlc: Hlc;
}

/** An event of `type` at its current version. Throws an `EventShapeError` when the content does not fit. */
export function createEvent<T extends EventType>(
  meta: EventMeta,
  type: T,
  content: EventContent<T>,
): EventEnvelope<T, CurrentVersion<T>> {
  return readEvent({
    id: meta.id,
    deviceId: meta.deviceId,
    hlc: meta.hlc,
    type,
    version: currentVersion(type),
    content,
  }) as EventEnvelope<T, CurrentVersion<T>>;
}

const envelope = record({
  id: id<"event">(),
  deviceId: id<"device">(),
  hlc: (value, path) => {
    if (!isHlc(value))
      throw new EventShapeError(path, "is not a clock timestamp");
    return value;
  },
  type: (value, path) => {
    if (typeof value !== "string" || !Object.hasOwn(definitions, value)) {
      throw new EventShapeError(
        path,
        `is not a known event type: ${JSON.stringify(value)}`,
      );
    }
    return value as EventType;
  },
  version: (value) => value,
  content: (value) => value,
});

/** Reads a stored event, at any version its type has had. Throws an `EventShapeError` when it does not fit. */
export function readEvent(value: unknown): WeftEvent {
  const event = envelope(value, "event");
  const versions: Record<number, Reader<unknown>> = definitions[event.type]
    .versions;
  const version = event.version;
  if (typeof version !== "number" || !Object.hasOwn(versions, version)) {
    throw new EventShapeError(
      "event.version",
      `is not a known version of "${event.type}": ${JSON.stringify(version)}`,
    );
  }
  return {
    ...event,
    version,
    content: versions[version]!(event.content, "event.content"),
  } as WeftEvent;
}

/** The order events apply in on every device: by clock, then by the device that wrote them. */
export function compareEvents(a: EventMeta, b: EventMeta): number {
  return (
    compareStrings(a.hlc, b.hlc) ||
    compareStrings(a.deviceId, b.deviceId) ||
    compareStrings(a.id, b.id)
  );
}

function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
