import { constants } from "node:os";

import { queryDatabase } from "./database.ts";
import { instanceName, VerifyError } from "./instance.ts";
import { doctor, down, env, Interrupted, up } from "./stack.ts";

const HELP = `verify: start, check and stop isolated Weft desktop instances. It never drives the app.

Every command prints one JSON object on stdout: {"ok":true,...} or {"ok":false,"error":...,"hint":...}.
Each instance (--instance <name> or WEFT_INSTANCE, default "main") has its own data folder, debugging
port, logs and agent-browser session under .verify/instances/<name>/, and evidence under
.verify/evidence/<name>/. Evidence and logs survive "down".

Commands:
  up [--packaged]   Build apps/desktop and open it on the instance's data folder with a debugging port,
                    and wait until its window has painted. A running instance is reused, or rebuilt and
                    relaunched if the working tree changed. --packaged opens the packaged app instead
                    (bun run --cwd apps/desktop package first), which refuses the debugging port.
  doctor            Read-only health check. Run it first when anything looks off.
  env               Print the data folder, database, debugging port, session, evidence and logs paths.
  db "<SELECT ...>" One read-only statement against the instance's weft.db, running or not. It also
                    prints the file's inode and creation time, which survive a relaunch.
  down [--purge]    Quit the instance's Weft and close its agent-browser session. --purge also deletes
                    its data folder. Evidence and logs are kept.

Drive the window with agent-browser, per .claude/skills/verify-weft/SKILL.md:
  agent-browser --session <session> connect <debugPort>
`;

const FLAGS = new Set(["instance", "packaged", "purge"]);

export function parseArgs(argv: string[]) {
  const flags: Record<string, string | true> = {};
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (!arg.startsWith("--")) {
      positional.push(arg);
      continue;
    }
    const key = arg.slice(2);
    if (!FLAGS.has(key)) {
      throw new VerifyError(
        `unknown flag ${arg}`,
        "run: bun run verify --help",
      );
    }
    if (key === "instance") {
      const value = argv[++i];
      if (value === undefined || value.startsWith("--")) {
        throw new VerifyError(
          "--instance needs a name",
          "pass --instance <name>",
        );
      }
      flags[key] = value;
    } else flags[key] = true;
  }
  return { flags, positional };
}

async function main(): Promise<boolean> {
  const [command, ...rest] = process.argv.slice(2);
  if (
    command === undefined ||
    command === "help" ||
    command === "--help" ||
    command === "-h"
  ) {
    process.stdout.write(HELP);
    return true;
  }
  const { flags, positional } = parseArgs(rest);
  const name = instanceName(
    typeof flags.instance === "string" ? flags.instance : undefined,
  );
  let result: Record<string, unknown>;
  switch (command) {
    case "up":
      result = await up(name, { packaged: flags.packaged === true });
      break;
    case "doctor":
      result = await doctor(name);
      break;
    case "env":
      result = env(name);
      break;
    case "db": {
      if (positional.length !== 1) {
        throw new VerifyError(
          "db takes one quoted statement",
          'such as: bun run verify db "PRAGMA schema_version"',
        );
      }
      result = {
        ok: true,
        instance: name,
        ...queryDatabase(name, positional[0]!),
      };
      break;
    }
    case "down":
      result = await down(name, { purge: flags.purge === true });
      break;
    default:
      throw new VerifyError(
        `unknown command "${command}"`,
        "run: bun run verify --help",
      );
  }
  print(result);
  return result.ok === true;
}

function print(value: Record<string, unknown>): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

if (import.meta.main) {
  main().then(
    (ok) => process.exit(ok ? 0 : 1),
    (error: unknown) => {
      if (error instanceof VerifyError) {
        print({ ok: false, error: error.message, hint: error.hint });
      } else {
        print({
          ok: false,
          error: String(error instanceof Error ? error.stack : error),
          hint: "unexpected failure; read .verify/instances/<instance>/logs",
        });
      }
      process.exit(
        error instanceof Interrupted
          ? 128 + constants.signals[error.signal]
          : 1,
      );
    },
  );
}
