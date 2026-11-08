# AGENTS.md

Weft keeps one person's life as Entries on Threads, on their own device. It is a Bun and Turbo monorepo in plain TypeScript. Run every command from the repo root with `bun`, never npm, yarn or pnpm.

## Checks

`bun run check` type-checks, lints and tests every workspace. CI runs the same command on every pull request.

- `bun run lint`: oxlint, then oxfmt in check mode. `bun run format` fixes formatting.
- `bun run typecheck`: `tsc` in each workspace, then on `tooling/`.
- `bun run test`: `bun test` in each workspace, then the tests in `tooling/`.
- One workspace: `bunx turbo run <task> --filter=@weft/<name>`.

## Where things live

The split is ADR 0008:

- `packages/core`: the rules, the event definitions, and building tables from events. No framework, driver or Node code.
- `packages/store`: the database and crypto seams, the event log, and later the sync client. It never touches a driver or Node directly; each host provides the seams (ADR 0005).
- `packages/app`: the React interface.
- `apps/desktop`: the Electron host. It opens the database and provides the seams.

Lint fails on any Node built-in, Bun API (except `bun:test`), Electron or database driver import in `core` or `store`. The rule is the override in `.oxlintrc.json`, and `tooling/import-boundaries.test.ts` checks it. A new workspace held to the same boundary goes in that override's `files`.

## The desktop app

Run these from the repo root.

- `bun run --cwd apps/desktop dev`: Vite serves the interface with hot reload and Electron opens on it. Changes to the main process need a restart.
- `bun run --cwd apps/desktop build`, then `bun run --cwd apps/desktop start`: the built app, unpackaged.
- `bun run --cwd apps/desktop package`: an ad-hoc signed macOS app for this Mac, at `apps/desktop/out/Weft-darwin-<arch>/Weft.app`. Not the release build.

Two environment variables point a run:

- `WEFT_USER_DATA=<folder>` opens the app on that folder, packaged or not, and creates `weft.db` there. Without it, an unpackaged run uses `apps/desktop/.dev-user-data` and a packaged one uses `~/Library/Application Support/Weft`, the owner's data. Development and verification always use their own folder. To run the packaged app on one: `WEFT_USER_DATA=<folder> apps/desktop/out/Weft-darwin-arm64/Weft.app/Contents/MacOS/Weft`.
- `WEFT_DEBUG_PORT=<port>` opens Chromium's debugging port on 127.0.0.1, so agent-browser can drive the window (`agent-browser connect <port>`). Only unpackaged runs accept it. A packaged build ignores it, along with `--remote-debugging-port`, `--remote-debugging-pipe` and `--inspect`.

One Weft runs per folder: launching again on the same folder brings the running window forward and exits. Runs on different folders run side by side.

On stdout, a run prints `Weft opened <path to weft.db> (SQLite <version>)`, then `Weft showed <url>` once the window has painted. A second launch on a folder in use prints `Weft is already open on <folder>; showing its window.` If your shell sets `ELECTRON_RUN_AS_NODE` (some editors built on Electron do), unset it before running Electron yourself; the dev script already does.

## Language and decisions

- Use the terms in `GLOSSARY.md` for the concepts it defines, in conversation, code, issues, commits and UI copy. When a concept you need is missing, or a term seems to mean two things, say so instead of inventing a synonym.
- Decisions are in `docs/adr/`. Say so when a change contradicts one.
- Conventional commits with a scope: `<type>(<scope>): <description>`. Issues live in GitHub; use the `gh` CLI.
