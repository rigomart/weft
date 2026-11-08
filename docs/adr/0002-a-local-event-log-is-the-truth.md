# A local event log is the truth

**Status:** Accepted
**Date:** 2026-11-08

Weft keeps a person's data on their device and syncs it optionally (ADR 0003). Vita OS assumes the server holds the truth (revision compare-and-swap, refused conflicts) and rejected adding sync to that shape as too large (Vita OS ADR 0042). Its Activity Log was added beside the data and needed two ADRs (0053, 0054) to tell a Thread's story.

## Decision

**The device's append-only log of events is the truth.** Every change is an event: an Entry written, a Follow-up date set or completed, an Entry put on or taken off a Thread, a Thread resolved. The tables the views read are built from the events and can be dropped and rebuilt at any time.

- **IDs are made on the device**, sortable by time, and never assigned by a server.
- **Every event carries** its ID, the device that wrote it, a hybrid logical clock timestamp for ordering across devices, a type named from ADR 0001's glossary, and a version number for its shape from the first commit.
- **Deleting is an event.** Nothing is erased from the log, so other devices learn about deletions.
- **Conflicts:** for one person on a few devices, the later event wins, per field.
- **History is a reading of the log**, not a second record.

## Considered Options

- **The server holds the truth and the desktop caches it** (Vita OS). Offline is second-class, an account is required, and sync is a redesign.
- **Local tables are the truth, and sync exchanges changed rows.** A normal schema with normal migrations, but history is again a separate log beside the data.

## Consequences

- A wrong table design costs a rebuild, not a migration, while the model is still being found.
- Event shapes are permanent. Changing one means a new version and code that reads old versions. Keep events few and coarse.
- Rebuilding gets slower as the log grows. Snapshots fix that when it matters, not before.
