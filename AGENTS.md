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

## Language and decisions

- Use the terms in `GLOSSARY.md` for the concepts it defines, in conversation, code, issues, commits and UI copy. When a concept you need is missing, or a term seems to mean two things, say so instead of inventing a synonym.
- Decisions are in `docs/adr/`. Say so when a change contradicts one.
- Conventional commits with a scope: `<type>(<scope>): <description>`. Issues live in GitHub; use the `gh` CLI.
