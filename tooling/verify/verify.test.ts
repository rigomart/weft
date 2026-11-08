import { describe, expect, test } from "bun:test";

import { parseArgs } from "./cli.ts";
import { checkQuery } from "./database.ts";
import { instanceName } from "./instance.ts";
import { readLaunchLog } from "./launch-log.ts";

describe("instance names", () => {
  test("take lowercase letters, digits and dashes", () => {
    expect(instanceName("shell-relaunch-2")).toBe("shell-relaunch-2");
  });

  test.each(["", "Main", "a b", "../owner", "-lead", "x".repeat(41)])(
    "refuse %p",
    (name) => {
      expect(() => instanceName(name)).toThrow("invalid instance name");
    },
  );
});

describe("arguments", () => {
  test("read the instance, the flags and one statement", () => {
    expect(
      parseArgs(["--instance", "a", "--purge", "SELECT 1", "--packaged"]),
    ).toEqual({
      flags: { instance: "a", purge: true, packaged: true },
      positional: ["SELECT 1"],
    });
  });

  test("refuse a flag the CLI does not have", () => {
    expect(() => parseArgs(["--dry-run"])).toThrow("unknown flag --dry-run");
  });

  test("refuse --instance without a name", () => {
    expect(() => parseArgs(["--instance"])).toThrow("--instance needs a name");
    expect(() => parseArgs(["--instance", "--purge"])).toThrow(
      "--instance needs a name",
    );
  });
});

describe("db statements", () => {
  test.each([
    "SELECT 1",
    "select 1;",
    "  PRAGMA schema_version ; ",
    "WITH t AS (SELECT 1) SELECT * FROM t",
  ])("accept the read %p", (sql) => {
    expect(checkQuery(sql)).toBe(sql.trim().replace(/;\s*$/, ""));
  });

  test.each(["", ";", "SELECT 1; SELECT 2", "SELECT 1; DROP TABLE x"])(
    "refuse %p, which is not exactly one statement",
    (sql) => {
      expect(() => checkQuery(sql)).toThrow("exactly one statement");
    },
  );

  test.each(["DELETE FROM events", "ATTACH 'x.db' AS x", "VACUUM"])(
    "refuse the write %p",
    (sql) => {
      expect(() => checkQuery(sql)).toThrow("db only reads");
    },
  );
});

describe("the desktop host's log", () => {
  test("names the database it opened and the address it showed", () => {
    const log = readLaunchLog(
      [
        "--- up unpackaged 2026-11-08T21:37:08.692Z",
        "DevTools listening on ws://127.0.0.1:9340/devtools/browser/x",
        "Weft opened /repo/.verify/instances/a/data/weft.db (SQLite 3.45.1)",
        "Weft showed app://weft/",
        "Weft's window warning: slow (app://weft/x.js:1)",
      ].join("\n"),
    );
    expect(log).toEqual({
      opened: "/repo/.verify/instances/a/data/weft.db",
      showed: "app://weft/",
      alreadyOpen: false,
      windowMessages: ["Weft's window warning: slow (app://weft/x.js:1)"],
    });
  });

  test("says when another Weft held the folder", () => {
    expect(
      readLaunchLog(
        "Weft is already open on /repo/.verify/instances/a/data; showing its window.\n",
      ).alreadyOpen,
    ).toBe(true);
  });

  test("keeps the first failure", () => {
    expect(
      readLaunchLog(
        "Weft could not open its database: locked\nWeft could not start: later\n",
      ).failure,
    ).toBe("Weft could not open its database: locked");
  });
});
