# One contract, thin clients

**Status:** Accepted
**Date:** 2026-11-08

The interface needs one way to reach Weft that works the same on every client: the desktop window today, a phone app and maybe a web client later. T3 Code splits its clients from a local backend the same way, but its clients reach that backend over a WebSocket. Settled on 2026-11-08 after review of the proposal in #26.

## Decision

**The contract is the line between the interface and Weft.** It lives in `packages/contracts` and covers the reads the views need, the commands that write events, and notifications when the tables change. `packages/app` imports only the contract, never `store`, a driver or Electron. Each client implements it:

- **In-process**, over `store` (`openWeft` in `packages/store`). The desktop's main process serves the in-process implementation over IPC, and a phone app would call it directly.
- **Over IPC** on desktop (#29), in the window.
- **In the browser**, later, if the web client below is built.

**The contract is transport-independent, and messages that cross a process boundary are validated at runtime.** It is TypeScript types plus a reader for every message: commands, queries, read results, notifications and errors. A transport reads each message with them before using it. The readers are written by hand on the ones `core` already uses for events (`@weft/core/shape`), so there is nothing to install. Measured with `depfit` on 2026-11-08, the libraries would add valibot 1.5.0 (1 package, 1.9 MB), zod 4.6.7 (1 package, 6.1 MB) or arktype 2.2.9 (4 packages, 960.8 KB).

**One contract suite runs against every implementation** (`@weft/contracts/suite`). The same commands give the same reads, in the same order, with the same errors, and a repeated command stores its events once. Each implementation's package imports the suite and runs it. Every test gets a new, empty event log. The database seam's suite is run the same way, once per driver.

**Desktop keeps ADR 0005's shape:** SQLite in Electron's main process (ADR 0005's amendment), reached from the window over IPC, with no local server, socket or port.

**The command pipeline:**

- Each command writes one event. The event and the table changes it makes commit in one transaction (ADR 0002).
- Event IDs are made on the device. The client makes the ID of the event a command writes, and the IDs of any Entry or Thread it creates, and sends them with the command. Running a command again with the same event ID stores nothing new, whatever else the command says, so a client unsure whether a command went through sends it again.
- There are no command receipts, because the event log already says which commands went through.
- The events not yet sent are the later sync queue (ADR 0003). There is no separate outbox.

**No Effect.** Weft is plain TypeScript. ADR 0003 counted Effect as a cost of LiveStore, and no other part of Weft adopts it.

## Direction for release 2, not decided

A web client could implement the contract in the browser, reading the sealed log from the cloud (ADRs 0003 and 0004). Open questions:

- How the key is unlocked in a browser without typing the recovery code on every visit (ADR 0004).
- Whether the sealed events are kept in browser storage, for incremental pulls and reading offline, or held in memory only.
- How a write waits for the sync relay's acknowledgement, so closing a tab never loses one.
- How long a full replay takes as the log grows.

## Considered Options

- **A local backend over a WebSocket, as T3 Code has.** T3 Code needs it to serve remote clients, and Weft has none. It would add a localhost endpoint any web page can try to reach, tokens to guard it, a process to start and watch, and native modules to package for that process. Verification does not need it either: agent-browser drives the real Electron window over its debugging port.
- **The interface importing `store` directly.** The quickest start, but the window cannot open the database (ADR 0005), and each client would grow its own way to reach Weft, with nothing to show they behave the same.
- **A schema library** (valibot, zod or arktype). The contract's messages repeat shapes `core` already reads by hand, so a library would mean two ways to describe one shape.

## Consequences

- Each new read or command is added to the contract, its readers and its suite, then to each implementation.
- A new transport is proven by running the suite against it.
- Completing a Follow-up date is not a command yet: working out a Repeat's next occurrence is a rule `core` does not have.
- Amends ADR 0005 (where `store` runs) and ADR 0008 (adds `packages/contracts`).
