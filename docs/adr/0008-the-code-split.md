# How the code is split

**Status:** Accepted
**Date:** 2026-11-08

Vita OS converged on rules in a framework-free package with hosts around it. That split let it move from Convex to Cloudflare and gain a desktop app without rewriting its rules (Vita OS ADR 0042).

## Decision

**A Bun and Turbo monorepo**, as Vita OS:

- `packages/core`: the rules, the event definitions, and building tables from events. No framework, driver or Node code.
- `packages/store`: the database and crypto seams, the event log, and the sync client.
- `packages/app`: the React interface, with shadcn/ui as shipped and no styling of our own until a later design pass.
- `apps/desktop`: the Electron host.
- `apps/sync`: the Worker and the Durable Object (ADR 0003).

The glance view starts as a port of Vita OS's Dashboard, adjusted to Entries and Updates.

## Considered Options

- **One app package.** The fastest start, but rules mix with the interface and storage, and a second host means pulling them apart.
- **Only `core` and `app`, with thin hosts.** Storage and sync land in the app or the host, where Vita OS first put them and later had to move them out.
