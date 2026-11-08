# The packaged app

The packaged `Weft.app` opens on a data folder, creates its database and event log there through libsql, keeps the Entries in it, refuses a debugging port, and opens the same file again after a relaunch.

## Entry points and variants

- `bun run --cwd apps/desktop package`, then `verify up --packaged` on a new instance name

## Preconditions

- The app packaged from the current tree (package again after any code change)

## Checks

1. `up --packaged` prints `"build":"packaged"`, `"debugPort":null` and a `requestedDebugPort`.
2. This run's lines in `appLog` are exactly, in order: `Weft ignores WEFT_DEBUG_PORT in a packaged build.`, `Weft opened <database> (SQLite <version>)` with the instance's own `database`, and `Weft showed app://weft/`.
3. `lsof -nP -a -p <pid> -iTCP -sTCP:LISTEN` prints nothing, and `doctor` is `ok` with `debugPortRefused: true`.
4. Record `file.inode` and `file.createdAt` from `verify db "PRAGMA schema_version"`. After `verify down` and `verify up --packaged`, both are the same.
5. On a new instance, the packaged app's first launch creates the event log: `verify db "SELECT id FROM device"` gives one row. Then `down`, `up` (unpackaged), capture an Entry in the window, `down`, and `up --packaged` twice with a `down` after each: `SELECT (SELECT count(*) FROM events) AS events, (SELECT group_concat(body) FROM entries) AS entries, (SELECT id FROM device) AS device` is the same after each packaged run, with the device ID from its first launch, and `doctor` shows `windowMessages` `[]` (a window whose preload failed prints an error there).

## Traps

- agent-browser cannot drive the packaged window, by design. Its screen is proven on the unpackaged build ([open the app](open-the-app.md)).
- `up --packaged` never packages. An old `out/` runs old code.
