# Importing from Vita OS

**Status:** Accepted
**Date:** 2026-11-08

Weft replaces Vita OS, which the owner uses daily. Vita OS stays in use as the reference until Weft takes over, then it is sunset.

## Decision

**A one-time importer reads a Vita OS export into an empty Weft database,** the way Vita OS imports into its desktop app (Vita OS ADR 0042). It writes ordinary events, so the imported history reads like any other:

- Threads become Threads, keeping Open or Resolved.
- Thread Notes become Entries on their Thread.
- Tasks become Entries with a Follow-up date, keeping any Repeat.
- A note written while completing a Task becomes an Update.
- Standalone Notes become Loose Entries; completed ones are put away.
- Activity Log entries become the events they describe, where those can be recovered.
- **Areas are dropped.** The owner rarely uses them (ADR 0001).

## Consequences

- The importer refuses a database that already holds data.
- Vita OS stays the reference for behaviour worth keeping, such as missed Repeats collapsing and colour belonging to time.
