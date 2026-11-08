# Electron on desktop, SQLite behind a seam

**Status:** Accepted
**Date:** 2026-11-08

Weft is a desktop app first. A phone app may come later. Vita OS already runs on desktop with Electron and a SQLite file through libsql behind a small database seam (Vita OS ADR 0042), with releases worked out (ADR 0043).

## Decision

**Desktop is Electron, with the data in a SQLite file in the app's user-data folder,** opened from the main process. The file is covered by the computer's own backups.

**`core` and `store` never touch a driver, Node or WebCrypto directly.** They use two seams, a database seam (as Vita OS's) and a crypto seam, and each host provides its own implementations. They use no Node-only API.

**The first driver is `@libsql/client`** (0.18.0, 14 packages, 11.4 MB), proven in this setup by Vita OS. `node:sqlite` (built in, nothing to install) gets another look once the seam exists.

**A phone app would be React Native with its own interface.** It reuses `core`, `store` and sync, with a phone SQLite driver and crypto behind the same seams. A phone wants its own screens anyway, so reusing the rules and sync matters more than reusing the interface.

## Considered Options

- **SQLite compiled to WebAssembly in the page** (`@sqlite.org/sqlite-wasm`). The same code could become a website or installable web app, but the data lives inside the browser engine's storage rather than as a visible file.
- **Tauri with SQLite on the Rust side.** A much smaller app and a mobile path, but it adds a Rust side and little of Vita OS's desktop work carries over. Its mobile advantage is about reusing one interface, which matters less than reusing the rules.
- **A native Swift phone app.** It would have to rewrite the rules that `core` holds in TypeScript.

## Consequences

- macOS first, as Vita OS. Windows, Linux, signing and auto-update come later (Vita OS ADR 0043 is the reference).
- A phone app means a second seam implementation, not a rewrite.
- The window reaches `store` only through the contract in ADR 0010, which the main process serves over IPC.

## Amendment: the database runs in the main process

**Date:** 2026-11-08, decided in #28

The SQLite file is opened in Electron's main process, not in a `utilityProcess`. The window reaches it over IPC to main. There is no local server, socket or port.

- One process fewer, and no second hop for every call through main or a `MessagePort`.
- Main holds the single-instance lock for the data folder, so the process that opens the file is the one that owns it.
- libsql's file driver does its work synchronously behind its promises, so each query holds main's event loop while it runs. Queries on one person's data are short.

Considered: **a `utilityProcess` for the database.** It keeps main responsive during long queries and survives a crash in the native driver, at the cost of a second process to start, watch and package, and a relay for every call.

Look again if rebuilding tables from the log (ADR 0002), or any other query, visibly stalls the window. Moving the database then changes only `apps/desktop`, because `store` reaches it through the same database seam either way.
