import { expect, test } from "bun:test";
import { makeId, type Instant, type ThreadListItem } from "@weft/contracts";

import { threadChoices } from "./thread-picker.tsx";

let ms = Date.UTC(2026, 10, 8);
const thread = (name: string, resolved = false): ThreadListItem => ({
  threadId: makeId<"thread">(ms++, () => new Uint8Array(10)),
  name,
  resolvedAt: resolved ? ("2026-11-08T10:00:00.000Z" as Instant) : null,
});

const labels = (choices: ReturnType<typeof threadChoices>) =>
  choices.map((choice) =>
    choice.kind === "thread" ? choice.thread.name : `new ${choice.name}`,
  );

test("offers the Threads whose name contains what was typed, open first, then a new one", () => {
  const threads = [thread("Car", true), thread("Teeth"), thread("Sleep")];
  expect(labels(threadChoices(threads, [], ""))).toEqual([
    "Teeth",
    "Sleep",
    "Car",
  ]);
  expect(labels(threadChoices(threads, [], "e"))).toEqual([
    "Teeth",
    "Sleep",
    "new e",
  ]);
  expect(labels(threadChoices(threads, [], "  work   stress "))).toEqual([
    "new work stress",
  ]);
});

test("offers no new Thread when one already has the name, even one the Entry is on", () => {
  const teeth = thread("Teeth");
  expect(labels(threadChoices([teeth], [], "teeth"))).toEqual(["Teeth"]);
  expect(labels(threadChoices([teeth], [teeth.threadId], "teeth"))).toEqual([]);
  expect(labels(threadChoices([teeth], [teeth.threadId], ""))).toEqual([]);
});
