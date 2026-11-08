# Our own sync, through one Durable Object per person

**Status:** Accepted
**Date:** 2026-11-08

Sync is optional: the app works fully without an account. Cloudflare hosts anything in the cloud. Sharing is not planned (ADR 0001), so each log belongs to one person.

## Decision

**We build the sync.** Each person with sync turned on has one Cloudflare Durable Object, which stores their events in its own SQLite storage and gives each one a sequence number. A device pushes the events it has not sent and pulls every event after the last sequence number it saw. Pushing is idempotent by event ID, so a retry never duplicates an event. The Durable Object stores sealed events (ADR 0004) and never reads them.

An account exists only to reach your own Durable Object. Accounts and the Worker in front of the Durable Object follow Vita OS's setup (Hono on Workers, Better Auth on D1).

## Considered Options

`depfit`, run 2026-11-08:

- **LiveStore** (0.5.0): the same event-log design, already built, with a Cloudflare backend. Before 1.0, 68 packages and 127.9 MB, requires Effect 4, and has 3 vulnerabilities in its dependencies.
- **TinyBase** (10.0.1): light (1 package), mature, and has a Durable Object synchronizer. It syncs current state rather than events, which gives up ADR 0002.
- **Replicache**: its repository is archived, with no release in 494 days.
- **Automerge**: a document CRDT for editing text together, a different problem.

## Consequences

- We write and test ordering across devices, retries, and a new device's first full download.
- If sharing ever becomes a goal, this ADR is revisited, along with ADR 0004's keys.
