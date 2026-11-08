import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";

export const ROOT = resolve(import.meta.dir, "../..");
export const DESKTOP_DIR = join(ROOT, "apps/desktop");
export const VERIFY_DIR = join(ROOT, ".verify");

export type Build = "unpackaged" | "packaged";

/** What `up` records about a running instance, in `.verify/instances/<name>/state.json`. */
export type State = {
  instance: string;
  build: Build;
  /** The Electron main process. It leads its own process group. */
  pid: number;
  /** `pid` with its start time, so a pid reused after a crash never counts as this instance. */
  pidStamp: string;
  /** The port the run asked for. Only an unpackaged run opens it. */
  requestedDebugPort: number;
  /** Where this run's lines start in `app.log`. */
  logOffset: number;
  /** The working tree the unpackaged run was built from. */
  treeHash?: string;
  branch: string;
  gitSha: string;
  startedAt: string;
};

/** A failure with the next step to take; the CLI prints both as JSON. */
export class VerifyError extends Error {
  constructor(
    message: string,
    readonly hint: string,
  ) {
    super(message);
  }
}

export function instanceName(flag?: string): string {
  const name = flag ?? process.env.WEFT_INSTANCE ?? "main";
  if (!/^[a-z0-9][a-z0-9-]{0,39}$/.test(name)) {
    throw new VerifyError(
      `invalid instance name "${name}"`,
      "use up to 40 lowercase letters, digits and dashes, such as shell-relaunch",
    );
  }
  return name;
}

export function instancePaths(name: string) {
  const dir = join(VERIFY_DIR, "instances", name);
  const dataDir = join(dir, "data");
  const logsDir = join(dir, "logs");
  return {
    dir,
    state: join(dir, "state.json"),
    dataOwner: join(dir, "data-owner.json"),
    dataDir,
    database: join(dataDir, "weft.db"),
    logsDir,
    appLog: join(logsDir, "app.log"),
    buildLog: join(logsDir, "build.log"),
    evidenceRoot: join(VERIFY_DIR, "evidence", name),
  };
}

export function loadState(name: string): State | undefined {
  const path = instancePaths(name).state;
  return existsSync(path)
    ? (JSON.parse(readFileSync(path, "utf8")) as State)
    : undefined;
}

export function saveState(state: State): void {
  const paths = instancePaths(state.instance);
  mkdirSync(paths.dir, { recursive: true });
  writeFileSync(paths.state, `${JSON.stringify(state, null, 2)}\n`);
}

export function clearState(name: string): void {
  rmSync(instancePaths(name).state, { force: true });
}

export function requireState(name: string): State {
  const state = loadState(name);
  if (!state) {
    throw new VerifyError(
      `instance "${name}" is not up`,
      `run: ${verifyCommand(name, "up")}`,
    );
  }
  return state;
}

/**
 * What the data folder belongs to, kept until `down --purge`. `runId` names the evidence folder, so
 * the screenshots from before and after a relaunch land in one folder; `branch` is the branch the data
 * was made on, checked by `up` even when the instance is not running.
 */
export type DataOwner = { runId: string; branch: string };

export function loadDataOwner(name: string): DataOwner | undefined {
  const path = instancePaths(name).dataOwner;
  return existsSync(path)
    ? (JSON.parse(readFileSync(path, "utf8")) as DataOwner)
    : undefined;
}

export function dataOwner(name: string): DataOwner {
  const existing = loadDataOwner(name);
  if (existing) return existing;
  const owner = {
    runId: new Date().toISOString().replace(/[:.]/g, "-"),
    branch: currentBranch(),
  };
  mkdirSync(instancePaths(name).dir, { recursive: true });
  writeFileSync(
    instancePaths(name).dataOwner,
    `${JSON.stringify(owner, null, 2)}\n`,
  );
  return owner;
}

export function evidenceDir(name: string): string {
  return join(instancePaths(name).evidenceRoot, dataOwner(name).runId);
}

/**
 * Refuses an instance folder that resolves anywhere but its own place under `.verify`, such as a
 * data folder symlinked to the owner's.
 */
export function checkInsideVerify(name: string): void {
  const { dir, dataDir } = instancePaths(name);
  const expected = join(realpathSync(ROOT), ".verify", "instances", name);
  for (const [path, want] of [
    [dir, expected],
    [dataDir, join(expected, "data")],
  ] as const) {
    if (existsSync(path) && realpathSync(path) !== want) {
      throw new VerifyError(
        `${path} resolves to ${realpathSync(path)}, outside this instance's folder`,
        `remove the link and run up again; verify only opens folders under ${join(ROOT, ".verify")}`,
      );
    }
  }
}

// agent-browser sessions are machine-wide but instances belong to one checkout, so the session names both.
const CHECKOUT_ID = createHash("sha256")
  .update(realpathSync(ROOT))
  .digest("hex")
  .slice(0, 6);

export function browserSession(name: string): string {
  return `weft-${name}-${CHECKOUT_ID}`;
}

export function verifyCommand(name: string, args: string): string {
  return `bun run verify ${args}${name === "main" ? "" : ` --instance ${name}`}`;
}

export function run(
  command: string[],
  cwd = ROOT,
  env: Record<string, string> = {},
) {
  const result = spawnSync(command[0]!, command.slice(1), {
    cwd,
    env: { ...process.env, ...env },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 256 * 1024 * 1024,
  });
  return {
    code: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

export function currentBranch(): string {
  return run(["git", "rev-parse", "--abbrev-ref", "HEAD"]).stdout.trim();
}

export function currentSha(): string {
  return run(["git", "rev-parse", "--short", "HEAD"]).stdout.trim();
}

/** Changes whenever a committed, staged, unstaged or untracked file does. */
export function treeHash(): string {
  const hash = createHash("sha256");
  hash.update(run(["git", "rev-parse", "HEAD"]).stdout);
  hash.update(run(["git", "diff", "HEAD", "--binary"]).stdout);
  const untracked = run([
    "git",
    "ls-files",
    "--others",
    "--exclude-standard",
    "-z",
  ]).stdout.split("\0");
  for (const file of untracked.filter(Boolean).sort()) {
    hash.update(`\0${file}\0`);
    try {
      hash.update(readFileSync(join(ROOT, file)));
    } catch {
      // Deleted while hashing, or a folder git reports for a nested repository.
    }
  }
  return hash.digest("hex").slice(0, 16);
}
