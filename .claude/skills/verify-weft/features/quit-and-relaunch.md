# Quit and relaunch

Quitting Weft and starting it again on the same data folder opens the same database file, not a new one, and keeps the theme you chose, which the data folder stores.

## Entry points and variants

- Quit: `verify down` without `--purge`, whose SIGTERM Electron handles as a quit. Relaunch: `verify up`
- The packaged build: [the packaged app](packaged-app.md), check 4

## Preconditions

- An instance after `up`, connected with agent-browser
- The theme switched with `d`, pressed with focus on a tab (click a tab first): `<html>`'s class flips between `dark` and `light`. A new instance follows macOS, so after the switch the class is the opposite of `matchMedia('(prefers-color-scheme: dark)').matches`

## Checks

1. Before quitting, record `file.inode` and `file.createdAt` from `verify db "PRAGMA schema_version"`, and `document.documentElement.className`.
2. `verify down` prints `"stopped":"quit"`, and `verify doctor` then says the instance is not up.
3. After `verify up` (`"reused":false`, a new `pid`), `verify db` prints the same `file.inode` and `file.createdAt` as in check 1.
4. `appLog` has the same `Weft opened <database> (SQLite <version>)` line under both `--- up` lines: `grep -c "^Weft opened <database> " <appLog>` is `2`.
5. After reconnecting (`connect <debugPort>`, since `down` closed the session), `document.documentElement.className` is the theme from check 1, and still the opposite of what `matchMedia('(prefers-color-scheme: dark)').matches` says macOS is set to.

## Traps

- `down` closes the agent-browser session, so connect again after `up`. The port can be the same or different: take it from `up`.
- A reload or relaunch selects Now again. The selected tab is not stored, so it is no evidence of kept data.
