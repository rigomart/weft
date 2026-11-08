import { describe, expect, test } from "bun:test";
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

// oxlint matches override `files` relative to the config file, so each probe
// gets a copy of the real config beside it.
const root = join(import.meta.dir, "..");
const oxlint = join(root, "node_modules", ".bin", "oxlint");

function lint(file: string, specifier: string) {
  const dir = mkdtempSync(join(tmpdir(), "weft-lint-"));
  cpSync(join(root, ".oxlintrc.json"), join(dir, ".oxlintrc.json"));
  mkdirSync(join(dir, dirname(file)), { recursive: true });
  writeFileSync(
    join(dir, file),
    `import * as probe from "${specifier}";\nexport { probe };\n`,
  );
  try {
    const result = Bun.spawnSync(
      [oxlint, "--format", "default", "--deny-warnings", file],
      {
        cwd: dir,
      },
    );
    return { exitCode: result.exitCode, output: result.stdout.toString() };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const forbidden = [
  ["node:fs", "import(no-nodejs-modules)"],
  ["fs", "import(no-nodejs-modules)"],
  ["fs/promises", "import(no-nodejs-modules)"],
  ["bun:sqlite", "eslint(no-restricted-imports)"],
  ["electron", "eslint(no-restricted-imports)"],
  ["electron/main", "eslint(no-restricted-imports)"],
  ["@libsql/client", "eslint(no-restricted-imports)"],
  ["@libsql/client/web", "eslint(no-restricted-imports)"],
  ["better-sqlite3", "eslint(no-restricted-imports)"],
  ["better-sqlite3/lib/database.js", "eslint(no-restricted-imports)"],
  ["@sqlite.org/sqlite-wasm", "eslint(no-restricted-imports)"],
] as const;

describe.each(["packages/core", "packages/store"])("%s", (workspace) => {
  test.each(forbidden)("rejects %s", (specifier, rule) => {
    const { exitCode, output } = lint(`${workspace}/src/probe.ts`, specifier);
    expect(exitCode).not.toBe(0);
    expect(output).toContain(rule);
  });

  test("allows bun:test", () => {
    const { exitCode, output } = lint(
      `${workspace}/src/probe.test.ts`,
      "bun:test",
    );
    expect(output).toContain("Found 0 warnings and 0 errors.");
    expect(exitCode).toBe(0);
  });
});

describe.each(["packages/app", "apps/desktop"])("%s", (workspace) => {
  test("may import Node built-ins", () => {
    const { exitCode, output } = lint(`${workspace}/src/probe.ts`, "node:fs");
    expect(output).toContain("Found 0 warnings and 0 errors.");
    expect(exitCode).toBe(0);
  });
});
