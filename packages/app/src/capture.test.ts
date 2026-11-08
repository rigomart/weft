import { expect, test } from "bun:test";
import { makeId, type Command, type Weft } from "@weft/contracts";

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
  const newId = <Kind extends "event" | "entry">(_kind: Kind) =>
    makeId<Kind>(ms++, () => new Uint8Array(10));
  return { sent, capture: createCapture(weft, newId) };
}

test("writes the trimmed text as a new Entry", async () => {
  const { sent, capture } = recording(["ok"]);
  expect(await capture("  Back stiff after the drive \n")).toBe(true);
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
  expect(await capture("   ")).toBe(false);
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
