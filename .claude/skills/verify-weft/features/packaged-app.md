# The packaged app

The packaged `Weft.app` opens on a data folder, creates its database there through libsql, refuses a debugging port, and opens the same file again after a relaunch.

## Entry points and variants

- `bun run --cwd apps/desktop package`, then `verify up --packaged` on a new instance name

## Preconditions

- The app packaged from the current tree (package again after any code change)

## Checks

1. `up --packaged` prints `"build":"packaged"`, `"debugPort":null` and a `requestedDebugPort`.
2. This run's lines in `appLog` are exactly, in order: `Weft ignores WEFT_DEBUG_PORT in a packaged build.`, `Weft opened <database> (SQLite <version>)` with the instance's own `database`, and `Weft showed app://weft/`.
3. `lsof -nP -a -p <pid> -iTCP -sTCP:LISTEN` prints nothing, and `doctor` is `ok` with `debugPortRefused: true`.
4. Record `file.inode` and `file.createdAt` from `verify db "PRAGMA schema_version"`. After `verify down` and `verify up --packaged`, both are the same.

## Traps

- agent-browser cannot drive the packaged window, by design. Its screen is proven on the unpackaged build ([open the app](open-the-app.md)).
- `up --packaged` never packages. An old `out/` runs old code.
