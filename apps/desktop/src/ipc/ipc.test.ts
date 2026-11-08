import { afterAll, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  makeId,
  WeftError,
  type TablesChanged,
  type Weft,
} from "@weft/contracts";
import { describeContract } from "@weft/contracts/suite";
import { openLibsqlDatabase } from "@weft/database-libsql";
import { openWeft } from "@weft/store";

import { connectWeft, WeftFailure } from "./connect.ts";
import type { WeftBridge } from "./protocol.ts";
import { forwardChanges, serveWeft } from "./serve.ts";

const folder = mkdtempSync(join(tmpdir(), "weft ipc "));
afterAll(() => rmSync(folder, { recursive: true, force: true }));

const randomBytes = (length: number) =>
  crypto.getRandomValues(new Uint8Array(length));

/**
 * Main's side and the window's side joined as Electron joins them: each message is copied with the
 * structured clone algorithm, and everything main sends the window (replies and notifications)
 * arrives later, in the order it was sent.
 */
function fakeChannel(weft: Weft) {
  const reported: unknown[] = [];
  const handlers = serveWeft(weft, (_call, error) => reported.push(error));
  const toWindow: (() => void)[] = [];
  function deliver(message: () => void) {
    toWindow.push(message);
    setTimeout(() => toWindow.shift()!());
  }
  const windowListeners = new Set<(message: unknown) => void>();
  const window = {
    send(change: TablesChanged) {
      const copy = structuredClone(change);
      deliver(() => {
        for (const listener of windowListeners) listener(copy);
      });
    },
  };
  const stopForwarding = forwardChanges(
    weft,
    () => window,
    (error) => reported.push(error),
  );
  const bridge: WeftBridge = {
    async call(call, message) {
      const reply = await handlers[call](structuredClone(message));
      return new Promise((resolve) =>
        deliver(() => resolve(structuredClone(reply))),
      );
    },
    onChanged(listener) {
      windowListeners.add(listener);
      return () => windowListeners.delete(listener);
    },
  };
  return { bridge, reported, stopForwarding };
}

let files = 0;
async function inProcess() {
  const database = openLibsqlDatabase(join(folder, `weft-${files++}.db`));
  const weft = await openWeft({
    database,
    deviceId: makeId(Date.now(), randomBytes),
    now: Date.now,
  });
  return { weft, database };
}

describeContract("over IPC, to in-process over @libsql/client", async () => {
  const { weft, database } = await inProcess();
  const channel = fakeChannel(weft);
  return {
    weft: connectWeft(channel.bridge),
    close: async () => {
      channel.stopForwarding();
      await database.close();
    },
  };
});

function writeEntry(body: string) {
  return {
    type: "write entry",
    eventId: makeId<"event">(Date.now(), randomBytes),
    entryId: makeId<"entry">(Date.now(), randomBytes),
    body,
    parentEntryId: null,
  } as const;
}

test("a failure that is not a refusal reaches the window with its message, and main hears of it", async () => {
  const failing: Weft = {
    run: () =>
      Promise.reject(new Error("SQLITE_FULL: database or disk is full")),
    read: () =>
      Promise.reject(new TypeError("Cannot read properties of undefined")),
    subscribe: () => () => {},
  };
  const channel = fakeChannel(failing);
  const weft = connectWeft(channel.bridge);

  const ran = await weft
    .run(writeEntry("Desk chair?"))
    .catch((e: unknown) => e);
  expect(ran).toBeInstanceOf(WeftFailure);
  expect(ran).not.toBeInstanceOf(WeftError);
  expect((ran as Error).message).toBe("SQLITE_FULL: database or disk is full");

  const read = await weft.read({ type: "entries" }).catch((e: unknown) => e);
  expect(read).toBeInstanceOf(WeftFailure);
  expect((read as Error).message).toBe("Cannot read properties of undefined");

  expect(channel.reported.map((error) => (error as Error).message)).toEqual([
    "SQLITE_FULL: database or disk is full",
    "Cannot read properties of undefined",
  ]);
});

test("a command still resolves when the window is gone or sending to it throws", async () => {
  const { weft, database } = await inProcess();
  const reported: unknown[] = [];
  let target: { send(change: TablesChanged): void } | undefined;
  const stop = forwardChanges(
    weft,
    () => target,
    (error) => reported.push(error),
  );

  await weft.run(writeEntry("Back stiff after the drive"));
  target = {
    send() {
      throw new TypeError("Object has been destroyed");
    },
  };
  await weft.run(writeEntry("Desk chair?"));

  expect((await weft.read({ type: "entries" })).length).toBe(2);
  expect(reported.map((error) => (error as Error).message)).toEqual([
    "Object has been destroyed",
  ]);
  stop();
  await database.close();
});

test("a notification that does not fit is dropped and reported, and the next one still arrives", async () => {
  let send: (message: unknown) => void = () => {};
  const bridge: WeftBridge = {
    call: () => Promise.reject(new Error("unused")),
    onChanged(listener) {
      send = listener;
      return () => {};
    },
  };
  const dropped: unknown[] = [];
  const weft = connectWeft(bridge, (error) => dropped.push(error));
  const heard: TablesChanged[] = [];
  weft.subscribe((change) => heard.push(change));

  send({ tables: ["notes"] });
  send({ tables: ["entries"] });

  expect(heard).toEqual([{ tables: ["entries"] }]);
  expect(dropped).toEqual([expect.any(WeftError)]);
});

test("a reply that does not fit the bridge rejects as a failure", async () => {
  const weft = connectWeft({
    call: () => Promise.resolve({ ok: "yes" }),
    onChanged: () => () => {},
  });
  expect(await weft.read({ type: "entries" }).catch((e: unknown) => e)).toEqual(
    new WeftFailure("Weft gave a reply that does not fit the bridge."),
  );
});
