import { spawn, spawnSync } from "node:child_process";
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readlinkSync,
  readSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

import { readLaunchLog } from "./launch-log.ts";
import {
  browserSession,
  clearState,
  currentBranch,
  currentSha,
  DESKTOP_DIR,
  evidenceDir,
  instancePaths,
  loadState,
  requireState,
  run,
  saveState,
  treeHash,
  verifyCommand,
  VerifyError,
  type Build,
  type State,
} from "./instance.ts";

/** Held by every `up` and `down` on this machine, in any checkout, so two never pick one port. */
const LOCK_PORT = 9339;
/** Away from Chromium's usual 9222 and Node's inspector at 9229. */
const FIRST_DEBUG_PORT = 9340;
const LOCK_WAIT_MS = 300_000;
const READY_TIMEOUT_MS = 60_000;
const QUIT_TIMEOUT_MS = 10_000;

/** What `up` and `down` throw after SIGINT or SIGTERM. */
export class Interrupted extends VerifyError {
  constructor(readonly signal: NodeJS.Signals) {
    super(
      `stopped by ${signal}`,
      "it stopped the Weft it had started, if any; run the command again",
    );
  }
}

export function publicEnv(name: string, state: State) {
  const paths = instancePaths(name);
  return {
    instance: name,
    build: state.build,
    pid: state.pid,
    dataDir: paths.dataDir,
    database: paths.database,
    debugPort: state.build === "unpackaged" ? state.requestedDebugPort : null,
    ...(state.build === "packaged"
      ? { requestedDebugPort: state.requestedDebugPort }
      : {}),
    session: browserSession(name),
    evidenceDir: evidenceDir(name),
    logsDir: paths.logsDir,
    appLog: paths.appLog,
    branch: state.branch,
    gitSha: state.gitSha,
    startedAt: state.startedAt,
  };
}

/** The pid with its start time, in UTC and the C locale so every caller prints the same. */
function processStamp(pid: number): string | undefined {
  const ps = run(["ps", "-p", String(pid), "-o", "lstart="], undefined, {
    TZ: "UTC",
    LC_ALL: "C",
  });
  const started = ps.stdout.trim();
  return ps.code === 0 && started ? `${pid} ${started}` : undefined;
}

function alive(state: State): boolean {
  return processStamp(state.pid) === state.pidStamp;
}

function groupMembers(pgid: number): number[] {
  const ps = run(["ps", "-A", "-o", "pid=,pgid="]);
  return ps.stdout
    .split("\n")
    .map((line) => line.trim().split(/\s+/).map(Number))
    .filter(([, group]) => group === pgid)
    .map(([pid]) => pid!);
}

function signal(pid: number, name: NodeJS.Signals): void {
  try {
    process.kill(pid, name);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
  }
}

/** Electron handles SIGTERM as a quit. Whatever is left of the group after the timeout is killed. */
async function quit(state: State): Promise<"quit" | "killed" | "not running"> {
  if (!alive(state)) return "not running";
  signal(state.pid, "SIGTERM");
  const deadline = Date.now() + QUIT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (groupMembers(state.pid).length === 0) return "quit";
    await sleep(200);
  }
  signal(-state.pid, "SIGKILL");
  return "killed";
}

/** Listens on the port, or returns undefined when something already does. */
function listen(port: number): { stop(): void } | undefined {
  try {
    return Bun.listen({ hostname: "127.0.0.1", port, socket: { data() {} } });
  } catch {
    return undefined;
  }
}

function freePort(): number {
  for (let port = FIRST_DEBUG_PORT; port < FIRST_DEBUG_PORT + 200; port++) {
    const probe = listen(port);
    if (probe) {
      probe.stop();
      return port;
    }
  }
  throw new VerifyError(
    `no free debugging port from ${FIRST_DEBUG_PORT} to ${FIRST_DEBUG_PORT + 199}`,
    "stop instances you no longer need with bun run verify down",
  );
}

/** A listening socket as a machine-wide lock: the OS frees it if its holder dies. */
async function lock(abort: AbortSignal): Promise<() => void> {
  const deadline = Date.now() + LOCK_WAIT_MS;
  while (true) {
    abort.throwIfAborted();
    const held = listen(LOCK_PORT);
    if (held) return () => held.stop();
    if (Date.now() > deadline) {
      throw new VerifyError(
        `port ${LOCK_PORT}, which up and down hold while they work, stayed taken for ${LOCK_WAIT_MS / 1000}s`,
        `see what holds it: lsof -nP -iTCP:${LOCK_PORT} -sTCP:LISTEN`,
      );
    }
    await sleep(500);
  }
}

async function locked<T>(body: (abort: AbortSignal) => Promise<T>) {
  const abort = new AbortController();
  const onSignal = (name: NodeJS.Signals) => abort.abort(new Interrupted(name));
  process.on("SIGINT", onSignal).on("SIGTERM", onSignal);
  try {
    const release = await lock(abort.signal);
    try {
      return await body(abort.signal);
    } finally {
      release();
    }
  } finally {
    process.off("SIGINT", onSignal).off("SIGTERM", onSignal);
  }
}

function readFrom(path: string, offset: number): string {
  if (!existsSync(path)) return "";
  const size = statSync(path).size;
  if (size <= offset) return "";
  const fd = openSync(path, "r");
  try {
    const buffer = Buffer.alloc(size - offset);
    readSync(fd, buffer, 0, buffer.length, offset);
    return buffer.toString("utf8");
  } finally {
    closeSync(fd);
  }
}

function runLog(name: string, state: Pick<State, "logOffset">) {
  return readLaunchLog(readFrom(instancePaths(name).appLog, state.logOffset));
}

function lastLines(name: string, offset: number): string {
  return readFrom(instancePaths(name).appLog, offset)
    .trim()
    .split("\n")
    .slice(-8)
    .join("\n");
}

/** Chromium writes the port it bound into the user-data folder, so a port another Weft holds never counts. */
function boundDebugPort(name: string): number | undefined {
  const file = join(instancePaths(name).dataDir, "DevToolsActivePort");
  if (!existsSync(file)) return undefined;
  return Number(readFileSync(file, "utf8").split("\n")[0]) || undefined;
}

/** Chromium's lock on a user-data folder is a symlink to `<host>-<pid>`. */
function singletonHolder(dataDir: string): number | undefined {
  try {
    const target = readlinkSync(join(dataDir, "SingletonLock"));
    return Number(/-(\d+)$/.exec(target)?.[1]) || undefined;
  } catch {
    return undefined;
  }
}

async function debugPortAnswers(port: number): Promise<boolean> {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/json/version`, {
      signal: AbortSignal.timeout(3000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

function electronBinary(logsDir: string): string {
  const require = createRequire(join(DESKTOP_DIR, "package.json"));
  const dir = join(require.resolve("electron/package.json"), "..");
  const binary = join(
    dir,
    "dist",
    readFileSync(join(dir, "path.txt"), "utf8").trim(),
  );
  if (existsSync(binary)) return binary;
  // bun install skips electron's postinstall, which downloads the binary.
  const install = run(["bun", join(dir, "install.js")], dir);
  writeFileSync(
    join(logsDir, "electron-install.log"),
    install.stdout + install.stderr,
  );
  if (install.code !== 0 || !existsSync(binary)) {
    throw new VerifyError(
      "the Electron binary is missing and could not be downloaded",
      `read ${join(logsDir, "electron-install.log")}`,
    );
  }
  return binary;
}

function packagedBinary(): string {
  const binary = join(
    DESKTOP_DIR,
    `out/Weft-darwin-${process.arch}/Weft.app/Contents/MacOS/Weft`,
  );
  if (!existsSync(binary)) {
    throw new VerifyError(
      `there is no packaged app at ${binary}`,
      "package it first: bun run --cwd apps/desktop package",
    );
  }
  return binary;
}

export type UpOptions = { packaged: boolean };

export function up(name: string, options: UpOptions) {
  return locked((abort) => upLocked(name, options, abort));
}

async function upLocked(name: string, options: UpOptions, abort: AbortSignal) {
  const build: Build = options.packaged ? "packaged" : "unpackaged";
  const existing = loadState(name);
  if (existing && existing.branch !== currentBranch()) {
    throw new VerifyError(
      `instance "${name}" was started on branch ${existing.branch}, and its data may not fit ${currentBranch()}`,
      `run: ${verifyCommand(name, "down --purge")} && ${verifyCommand(name, `up${options.packaged ? " --packaged" : ""}`)}`,
    );
  }
  if (existing && existing.build !== build && alive(existing)) {
    throw new VerifyError(
      `instance "${name}" is running the ${existing.build} app`,
      `quit it first, keeping its data: ${verifyCommand(name, "down")}`,
    );
  }
  let restarted = false;
  if (existing) {
    if (alive(existing) && runLog(name, existing).showed) {
      // The window shows the build from `up`, so a code change needs a new build.
      if (existing.build === "packaged" || existing.treeHash === treeHash()) {
        return { ok: true, reused: true, ...publicEnv(name, existing) };
      }
      restarted = true;
    }
    await quit(existing);
    clearState(name);
  }
  const state = await start(name, build, abort);
  return {
    ok: true,
    reused: false,
    ...(restarted ? { restarted: "the working tree changed since up" } : {}),
    ...publicEnv(name, state),
  };
}

async function start(
  name: string,
  build: Build,
  abort: AbortSignal,
): Promise<State> {
  const paths = instancePaths(name);
  for (const dir of [paths.dataDir, paths.logsDir, evidenceDir(name)]) {
    mkdirSync(dir, { recursive: true });
  }

  let tree: string | undefined;
  let command: string[];
  if (build === "unpackaged") {
    tree = treeHash();
    const result = run(["bun", "run", "build"], DESKTOP_DIR);
    writeFileSync(paths.buildLog, result.stdout + result.stderr);
    if (result.code !== 0) {
      throw new VerifyError(
        "the desktop app did not build",
        `read ${paths.buildLog}`,
      );
    }
    command = [electronBinary(paths.logsDir), DESKTOP_DIR];
  } else {
    command = [packagedBinary()];
  }
  abort.throwIfAborted();

  const port = freePort();
  rmSync(join(paths.dataDir, "DevToolsActivePort"), { force: true });
  const startedAt = new Date().toISOString();
  const logOffset = existsSync(paths.appLog) ? statSync(paths.appLog).size : 0;
  writeFileSync(paths.appLog, `--- up ${build} ${startedAt}\n`, { flag: "a" });

  // Electron turns into plain Node under ELECTRON_RUN_AS_NODE, which some editors set.
  const {
    ELECTRON_RUN_AS_NODE: _node,
    WEFT_RENDERER_URL: _renderer,
    ...env
  } = process.env;
  const log = openSync(paths.appLog, "a");
  const child = spawn(command[0]!, command.slice(1), {
    cwd: DESKTOP_DIR,
    env: {
      ...env,
      WEFT_USER_DATA: paths.dataDir,
      WEFT_DEBUG_PORT: String(port),
    },
    detached: true,
    stdio: ["ignore", log, log],
  });
  closeSync(log);
  child.unref();
  const pid = child.pid;
  const pidStamp = pid === undefined ? undefined : processStamp(pid);
  if (pid === undefined || pidStamp === undefined) {
    throw new VerifyError(
      `${command[0]} did not start`,
      `read ${paths.appLog}`,
    );
  }
  const state: State = {
    instance: name,
    build,
    pid,
    pidStamp,
    requestedDebugPort: port,
    logOffset,
    treeHash: tree,
    branch: currentBranch(),
    gitSha: currentSha(),
    startedAt,
  };
  saveState(state);
  try {
    await waitUntilReady(name, state, abort);
  } catch (error) {
    await quit(state);
    clearState(name);
    throw error;
  }
  return state;
}

/** Ready is the window painted, on this instance's database, with this instance's debugging port bound. */
async function waitUntilReady(name: string, state: State, abort: AbortSignal) {
  const paths = instancePaths(name);
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (true) {
    const log = runLog(name, state);
    if (log.opened !== undefined && log.opened !== paths.database) {
      throw new VerifyError(
        `Weft opened ${log.opened}, not the instance's ${paths.database}`,
        "the instance was stopped; check how apps/desktop reads WEFT_USER_DATA before driving anything",
      );
    }
    const portReady =
      state.build === "packaged" ||
      boundDebugPort(name) === state.requestedDebugPort;
    if (log.opened && log.showed && portReady) return;
    if (log.failure) {
      throw new VerifyError(log.failure, `read ${paths.appLog}`);
    }
    if (!alive(state)) {
      if (log.alreadyOpen) {
        const holder = singletonHolder(paths.dataDir);
        throw new VerifyError(
          `another Weft${holder ? ` (pid ${holder})` : ""} is already open on ${paths.dataDir}`,
          holder
            ? `quit it: kill -TERM ${holder}, then run up again`
            : `quit it: ls -l ${join(paths.dataDir, "SingletonLock")} names its pid after the dash`,
        );
      }
      throw new VerifyError(
        `Weft exited while starting:\n${lastLines(name, state.logOffset)}`,
        `read ${paths.appLog}`,
      );
    }
    if (Date.now() > deadline) {
      throw new VerifyError(
        `Weft was not ready after ${READY_TIMEOUT_MS / 1000}s${portReady ? "" : `; port ${state.requestedDebugPort} was not bound by it`}`,
        `read ${paths.appLog}, then run up again`,
      );
    }
    abort.throwIfAborted();
    await sleep(250);
  }
}

export async function doctor(name: string) {
  const state = requireState(name);
  const paths = instancePaths(name);
  const log = runLog(name, state);
  const answers = await debugPortAnswers(state.requestedDebugPort);
  const checks = {
    process: alive(state),
    windowShown: log.showed !== undefined,
    openedInstanceDatabase: log.opened === paths.database,
    databaseExists: existsSync(paths.database),
    // A packaged build refuses the port, which is what it should do.
    ...(state.build === "unpackaged"
      ? {
          debugPortAnswers:
            answers && boundDebugPort(name) === state.requestedDebugPort,
        }
      : { debugPortRefused: !answers }),
    branchMatches: currentBranch() === state.branch,
  };
  const healthy = Object.values(checks).every(Boolean);
  return {
    ok: healthy,
    checks,
    ...(state.build === "unpackaged"
      ? { builtFromCurrentTree: state.treeHash === treeHash() }
      : {}),
    windowMessages: log.windowMessages,
    ...(healthy
      ? {}
      : {
          error: "instance unhealthy",
          hint: checks.branchMatches
            ? `read ${paths.appLog}, then run: ${verifyCommand(name, "down")} && ${verifyCommand(name, "up")}`
            : `you switched branches since up: run ${verifyCommand(name, "down --purge")} && ${verifyCommand(name, "up")}`,
        }),
    ...publicEnv(name, state),
  };
}

export function env(name: string) {
  return { ok: true, ...publicEnv(name, requireState(name)) };
}

/** `close` on a session that is not running starts one first, so close only a listed session. */
function closeBrowserSession(session: string): boolean {
  const list = spawnSync("agent-browser", ["session", "list", "--json"], {
    encoding: "utf8",
    timeout: 15_000,
  });
  if (list.status !== 0) return false;
  const { data } = JSON.parse(list.stdout) as {
    data?: { sessions?: string[] };
  };
  if (!data?.sessions?.includes(session)) return false;
  spawnSync("agent-browser", ["--session", session, "close"], {
    stdio: "ignore",
    timeout: 15_000,
  });
  return true;
}

export type DownOptions = { purge: boolean };

export function down(name: string, options: DownOptions) {
  return locked(async () => {
    const paths = instancePaths(name);
    const evidence = paths.evidenceRoot;
    const closedSession = closeBrowserSession(browserSession(name));
    const state = loadState(name);
    const stopped = state ? await quit(state) : "not running";
    clearState(name);
    if (options.purge) {
      rmSync(paths.dataDir, { recursive: true, force: true });
      rmSync(paths.runId, { force: true });
    }
    return {
      ok: true,
      instance: name,
      stopped,
      closedSession,
      purged: options.purge ? paths.dataDir : null,
      kept: { evidence, logs: paths.logsDir },
    };
  });
}
