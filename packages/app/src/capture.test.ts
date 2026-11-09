import { expect, test } from "bun:test";
import {
  calendarDay,
  makeId,
  timeOfDay,
  type Command,
  type FollowUpDate,
  type Weft,
} from "@weft/contracts";

import { createCapture } from "./capture.ts";

function recording(outcomes: ("ok" | "fail")[]) {
  const sent: Command[] = [];
  const weft: Weft = {
    async run(command) {
      sent.push(command);
      if (outcomes.shift() === "fail") throw new Error("The window lost main.");
    },
    read: () => Promise.reject(new Error("unused")),
    subscribe: () => () => {},
  };
  let ms = Date.UTC(2026, 10, 8);
  const newId = <Kind extends "event" | "entry" | "thread">(_kind: Kind) =>
    makeId<Kind>(ms++, () => new Uint8Array(10));
  return { sent, capture: createCapture(weft, newId) };
}

test("writes the trimmed text as a new Entry", async () => {
  const { sent, capture } = recording(["ok"]);
  const written = await capture("  Back stiff after the drive \n");
  expect(written).toBe(entryIdOf(sent[0]!));
  expect(sent).toEqual([
    {
      type: "write entry",
      eventId: expect.any(String),
      entryId: expect.any(String),
      body: "Back stiff after the drive",
      parentEntryId: null,
    },
  ]);
});

test("writes nothing for an empty box", async () => {
  const { sent, capture } = recording([]);
  expect(await capture("   ")).toBeNull();
  expect(sent).toEqual([]);
});

test("a retry after a failure sends the same command, and the next capture a new one", async () => {
  const { sent, capture } = recording(["fail", "ok", "ok"]);
  await expect(capture("Desk chair?")).rejects.toThrow("The window lost main.");
  await capture("Desk chair?");
  await capture("Desk chair?");

  expect(sent[1]).toEqual(sent[0]!);
  expect(sent[2]).toMatchObject({ type: "write entry", body: "Desk chair?" });
  expect(sent[2]!.eventId).not.toBe(sent[0]!.eventId);
});

test("changing the text after a failure makes a new command", async () => {
  const { sent, capture } = recording(["fail", "ok"]);
  await expect(capture("Desk chair")).rejects.toThrow();
  await capture("Desk chair?");
  expect(sent[1]!.eventId).not.toBe(sent[0]!.eventId);
});

const entryIdOf = (command: Command) =>
  (command as Extract<Command, { type: "write entry" }>).entryId;

const tomorrow: FollowUpDate = {
  day: calendarDay("2026-11-09"),
  time: timeOfDay("09:30"),
  repeat: null,
};

test("with a Follow-up date, writes the Entry and then sets its date", async () => {
  const { sent, capture } = recording(["ok", "ok"]);
  expect(await capture("Book the checkup", tomorrow)).toBe(entryIdOf(sent[0]!));
  expect(sent).toEqual([
    expect.objectContaining({ type: "write entry", body: "Book the checkup" }),
    {
      type: "set follow-up date",
      eventId: expect.any(String),
      entryId: entryIdOf(sent[0]!),
      followUpDate: tomorrow,
    },
  ]);
  expect(sent[1]!.eventId).not.toBe(sent[0]!.eventId);
});

test("a retry after the date failed sends both commands again, unchanged", async () => {
  const { sent, capture } = recording(["ok", "fail", "ok", "ok"]);
  await expect(capture("Book the checkup", tomorrow)).rejects.toThrow();
  await capture("Book the checkup", tomorrow);
  expect(sent).toHaveLength(4);
  expect(sent[2]).toEqual(sent[0]!);
  expect(sent[3]).toEqual(sent[1]!);
});

test("a date changed after a failure is set on the same Entry, by a new command", async () => {
  const { sent, capture } = recording(["ok", "fail", "ok", "ok"]);
  await expect(capture("Book the checkup", tomorrow)).rejects.toThrow();
  await capture("Book the checkup", { ...tomorrow, time: null });
  expect(sent[2]).toEqual(sent[0]!);
  expect(sent[3]).toEqual({
    type: "set follow-up date",
    eventId: expect.any(String),
    entryId: entryIdOf(sent[1]!),
    followUpDate: { ...tomorrow, time: null },
  });
  expect(sent[3]!.eventId).not.toBe(sent[1]!.eventId);
});

test("an Update is written with the Entry it follows, and the same text for another Entry is a new one", async () => {
  const { sent, capture } = recording(["fail", "ok", "ok"]);
  const claim = makeId<"entry">(
    Date.UTC(2026, 10, 1),
    () => new Uint8Array(10),
  );
  const other = makeId<"entry">(
    Date.UTC(2026, 10, 2),
    () => new Uint8Array(10),
  );
  await expect(capture("Rejected", null, claim)).rejects.toThrow();
  await capture("Rejected", null, other);
  expect(sent[0]).toMatchObject({ type: "write entry", parentEntryId: claim });
  expect(sent[1]).toMatchObject({ type: "write entry", parentEntryId: other });
  expect(entryIdOf(sent[1]!)).not.toBe(entryIdOf(sent[0]!));
});
