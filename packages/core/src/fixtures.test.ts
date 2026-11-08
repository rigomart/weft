import { expect, test } from "bun:test";
import { eventTypes, eventVersions, readEvent } from "./events.ts";

// Every event type and version ever defined, each with a stored fixture in
// fixtures/events, written once and never edited. Lines are only ever added:
// this list is kept apart from the definitions so that dropping a version's
// reader fails here instead of quietly dropping its fixture.
const stored = [
  ["entry written", 1],
  ["entry edited", 1],
  ["entry deleted", 1],
  ["entry put away", 1],
  ["entry brought back", 1],
  ["entry put on thread", 1],
  ["entry taken off thread", 1],
  ["follow-up date set", 1],
  ["follow-up date cleared", 1],
  ["follow-up date completed", 1],
  ["thread started", 1],
  ["thread renamed", 1],
  ["thread resolved", 1],
  ["thread reopened", 1],
] as const;

const fixtures = stored.map(([type, version]) => ({
  type,
  version,
  file: `${type.replaceAll(" ", "-")}.v${version}.json`,
}));

test.each(fixtures)(
  "$file is still read as $type, version $version",
  async ({ type, version, file }) => {
    const { default: stored } = await import(`../fixtures/events/${file}`, {
      with: { type: "json" },
    });
    const event = readEvent(stored);
    expect<string>(event.type).toBe(type);
    expect<number>(event.version).toBe(version);
    expect(event).toEqual(stored);
  },
);

test("every defined type and version has a stored fixture", () => {
  const defined = eventTypes.flatMap((type) =>
    eventVersions(type).map((version) => `${type} v${version}`),
  );
  const listed = stored.map(([type, version]) => `${type} v${version}`);
  expect(listed.sort()).toEqual(defined.sort());
});
