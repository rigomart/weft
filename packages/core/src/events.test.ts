import { describe, expect, test } from "bun:test";
import { calendarDay, instant, timeOfDay } from "./dates.ts";
import {
  compareEvents,
  currentVersion,
  eventTypes,
  eventVersions,
  readEvent,
  type EventContent,
  type EventType,
} from "./events.ts";
import { EventShapeError } from "./shape.ts";
import { testDevice } from "./test-device.ts";

const NOV_8 = Date.UTC(2026, 10, 8, 20, 55, 55, 123);

function samples(entryId: string, otherEntryId: string, threadId: string) {
  const entry = entryId as EventContent<"entry written">["entryId"];
  const other = otherEntryId as typeof entry;
  const thread = threadId as EventContent<"thread started">["threadId"];
  const weekly = {
    day: calendarDay("2026-11-15"),
    time: timeOfDay("09:30"),
    repeat: { kind: "weekly", weekdays: [0, 3] },
  } as const;
  return {
    "entry written": {
      entryId: other,
      body: "Called the insurer; they want the form.",
      writtenAt: instant("2026-11-08T20:55:55.123Z"),
      parentEntryId: entry,
    },
    "entry edited": { entryId: entry, body: "Back stiff after the long drive" },
    "entry deleted": { entryId: entry },
    "entry put away": { entryId: entry },
    "entry brought back": { entryId: entry },
    "entry put on thread": { entryId: entry, threadId: thread },
    "entry taken off thread": { entryId: entry, threadId: thread },
    "follow-up date set": { entryId: entry, followUpDate: weekly },
    "follow-up date cleared": { entryId: entry },
    "follow-up date completed": {
      entryId: entry,
      completedAt: instant("2026-11-15T10:02:00.000Z"),
      completed: weekly,
      next: { ...weekly, day: calendarDay("2026-11-18") },
    },
    "thread started": { threadId: thread, name: "Insurance claim" },
    "thread renamed": { threadId: thread, name: "Car insurance claim" },
    "thread resolved": {
      threadId: thread,
      resolvedAt: instant("2026-12-01T08:00:00.000Z"),
    },
    "thread reopened": { threadId: thread },
  } satisfies { [T in EventType]: EventContent<T> };
}

describe("every event type", () => {
  const { writer, deviceId } = testDevice(1, NOV_8);
  const content = samples(
    writer.newId("entry"),
    writer.newId("entry"),
    writer.newId("thread"),
  );

  test.each(eventTypes)(
    "%s is created and read back with its version",
    (type) => {
      const event = writer.write(type, content[type] as never);
      expect(event.type).toBe(type);
      expect<number>(event.version).toBe(currentVersion(type));
      expect<string>(event.deviceId).toBe(deviceId);

      const stored = JSON.parse(JSON.stringify(event));
      expect<unknown>(readEvent(stored)).toEqual(event);
    },
  );

  test("each is at version 1, its only version", () => {
    for (const type of eventTypes) {
      expect(eventVersions(type)).toEqual([1]);
      expect(currentVersion(type)).toBe(1);
    }
  });

  test("an Update is an entry written with a parent; a first Entry has none", () => {
    const first = writer.write("entry written", {
      ...content["entry written"],
      parentEntryId: null,
    });
    expect(first.content.parentEntryId).toBeNull();
  });
});

describe("ordering", () => {
  test("two devices writing in the same millisecond have a stable order by their clock", () => {
    const a = testDevice(1, NOV_8);
    const b = testDevice(2, NOV_8);
    const write = (device: typeof a) =>
      device.writer.write("thread started", {
        threadId: device.writer.newId("thread"),
        name: "Car",
      });

    const events = [write(a), write(b), write(a), write(b)];
    const sorted = [...events].sort(compareEvents);

    expect(new Set(events.map((event) => event.hlc.slice(0, 24)))).toEqual(
      new Set(["2026-11-08T20:55:55.123Z"]),
    );
    const [first, second] = [a.deviceId as string, b.deviceId as string].sort();
    expect<unknown>(
      sorted.map((event) => [event.hlc.slice(25), event.deviceId]),
    ).toEqual([
      ["0000", first],
      ["0000", second],
      ["0001", first],
      ["0001", second],
    ]);
    expect([...events].reverse().sort(compareEvents)).toEqual(sorted);
  });

  test("a device's events stay in order when its wall clock goes back", () => {
    const device = testDevice(3, NOV_8);
    const first = device.writer.write("thread started", {
      threadId: device.writer.newId("thread"),
      name: "Car",
    });
    device.clock.ms -= 60_000;
    const second = device.writer.write("thread renamed", {
      threadId: first.content.threadId,
      name: "New car",
    });
    expect(compareEvents(first, second)).toBe(-1);
  });

  test("an event written after seeing another device's comes after it", () => {
    const ahead = testDevice(4, NOV_8 + 5_000);
    const behind = testDevice(5, NOV_8);
    const seen = ahead.writer.write("thread started", {
      threadId: ahead.writer.newId("thread"),
      name: "Car",
    });
    behind.writer.receive(seen.hlc);
    const reply = behind.writer.write("thread renamed", {
      threadId: seen.content.threadId,
      name: "New car",
    });
    expect(compareEvents(seen, reply)).toBe(-1);
  });
});

describe("reading refuses what does not fit", () => {
  const { writer } = testDevice(6, NOV_8);
  const stored = () =>
    JSON.parse(
      JSON.stringify(
        writer.write("follow-up date set", {
          entryId: writer.newId("entry"),
          followUpDate: {
            day: calendarDay("2026-11-15"),
            time: null,
            repeat: { kind: "days", every: 3 },
          },
        }),
      ),
    );

  const cases: [string, (event: any) => void, string][] = [
    ["an unknown type", (e) => (e.type = "entry archived"), "event.type"],
    [
      "the reserved attachment type",
      (e) => (e.type = "attachment added"),
      "event.type",
    ],
    ["an unknown version", (e) => (e.version = 2), "event.version"],
    ["a missing envelope field", (e) => delete e.hlc, "event.hlc"],
    ["an extra envelope field", (e) => (e.space = "personal"), "event.space"],
    [
      "an extra content field",
      (e) => (e.content.note = "x"),
      "event.content.note",
    ],
    [
      "a missing content field",
      (e) => delete e.content.followUpDate,
      "event.content.followUpDate",
    ],
    [
      "a day that does not exist",
      (e) => (e.content.followUpDate.day = "2026-02-29"),
      "event.content.followUpDate.day",
    ],
    [
      "a time with seconds",
      (e) => (e.content.followUpDate.time = "09:30:00"),
      "event.content.followUpDate.time",
    ],
    [
      "an unknown Repeat",
      (e) => (e.content.followUpDate.repeat = { kind: "yearly" }),
      "event.content.followUpDate.repeat.kind",
    ],
    [
      "a Repeat of 0 days",
      (e) => (e.content.followUpDate.repeat.every = 0),
      "event.content.followUpDate.repeat.every",
    ],
    [
      "weekdays out of order",
      (e) =>
        (e.content.followUpDate.repeat = { kind: "weekly", weekdays: [3, 1] }),
      "event.content.followUpDate.repeat.weekdays[1]",
    ],
    [
      "a malformed ID",
      (e) => (e.content.entryId = "entry-1"),
      "event.content.entryId",
    ],
    [
      "a malformed clock",
      (e) => (e.hlc = "2026-11-08T20:55:55Z-0"),
      "event.hlc",
    ],
  ];

  test.each(cases)("%s", (_, spoil, path) => {
    const event = stored();
    spoil(event);
    expect(() => readEvent(event)).toThrow(EventShapeError);
    try {
      readEvent(event);
    } catch (error) {
      expect((error as EventShapeError).path).toBe(path);
    }
  });

  test("writing refuses content that does not fit", () => {
    expect(() =>
      writer.write("entry written", {
        entryId: writer.newId("entry"),
        body: "   ",
        writtenAt: instant("2026-11-08T20:55:55.123Z"),
        parentEntryId: null,
      }),
    ).toThrow(
      new EventShapeError(
        "event.content.body",
        "is not text with something in it",
      ),
    );
  });

  test("an instant must be UTC to the millisecond", () => {
    expect(() => instant("2026-11-08T20:55:55Z")).toThrow(SyntaxError);
    expect(() => instant("2026-11-08T21:55:55.123+01:00")).toThrow(SyntaxError);
  });
});
