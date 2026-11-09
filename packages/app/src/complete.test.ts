import { expect, test } from "bun:test";
import {
  calendarDay,
  makeId,
  type Command,
  type FollowUpDate,
  type Weft,
} from "@weft/contracts";

import { createCompletion } from "./complete.ts";

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
  return { sent, complete: createCompletion(weft, newId) };
}

const entryId = makeId<"entry">(
  Date.UTC(2026, 10, 1),
  () => new Uint8Array(10),
);
const today: FollowUpDate = {
  day: calendarDay("2026-11-08"),
  time: null,
  repeat: null,
};

test("completes the Entry's Follow-up date", async () => {
  const { sent, complete } = recording(["ok"]);
  await complete(entryId, today);
  expect(sent).toEqual([
    { type: "complete follow-up date", eventId: expect.any(String), entryId },
  ]);
});

test("a retry after a failure sends the same command, and a later completion a new one", async () => {
  const { sent, complete } = recording(["fail", "ok", "ok"]);
  await expect(complete(entryId, today)).rejects.toThrow(
    "The window lost main.",
  );
  await complete(entryId, today);
  await complete(entryId, today);
  expect(sent[1]).toEqual(sent[0]!);
  expect(sent[2]!.eventId).not.toBe(sent[0]!.eventId);
});

test("a different date on the same Entry is a new completion", async () => {
  const { sent, complete } = recording(["fail", "ok"]);
  await expect(complete(entryId, today)).rejects.toThrow();
  await complete(entryId, { ...today, day: calendarDay("2026-11-15") });
  expect(sent[1]!.eventId).not.toBe(sent[0]!.eventId);
});
