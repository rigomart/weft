# How the code is split

**Status:** Accepted
**Date:** 2026-11-08

Vita OS converged on rules in a framework-free package with hosts around it. That split let it move from Convex to Cloudflare and gain a desktop app without rewriting its rules (Vita OS ADR 0042).

## Decision

**A Bun and Turbo monorepo**, as Vita OS:

- `packages/core`: the rules, the event definitions, and building tables from events. No framework, driver or Node code.
- `packages/store`: the database and crypto seams, the event log, and the sync client.
- `packages/contracts`: the contract between the interface and Weft, and the suite every client runs (ADR 0010). `packages/app` imports only the contract; `store` implements it in-process.
- `packages/app`: the React interface, with shadcn/ui as shipped and no styling of our own until a later design pass.
- `apps/desktop`: the Electron host.
- `apps/sync`: the Worker and the Durable Object (ADR 0003).

The glance view starts as a port of Vita OS's Dashboard, adjusted to Entries and Updates.

## Considered Options

- **One app package.** The fastest start, but rules mix with the interface and storage, and a second host means pulling them apart.
- **Only `core` and `app`, with thin hosts.** Storage and sync land in the app or the host, where Vita OS first put them and later had to move them out.

## Amendment: shadcn/ui on Base UI

**Date:** 2026-11-08, settled in #1 and set up in #28

`packages/app` uses shadcn/ui on Base UI (`@base-ui/react`), not Radix, with the `base-nova` style as the shadcn CLI ships it. Components are added with the CLI from `packages/app` and kept as shipped, apart from formatting. Hosts import `@weft/app/styles.css`.

The first design pass, which reshaped Now, replaces "no styling of our own until a later design pass" with this rule. The interface uses shadcn/ui as shipped, composed with Tailwind's layout utilities: flex, grid, gap, padding and width. Type is the style's own Geist, set with Tailwind's text utilities, and colour comes from the style's theme tokens. A class overrides a component's own styles only for layout, such as a width or a gap. The one token of Weft's own is `--late`, because colour belongs to time (ADR 0009). Adding a second token means amending this ADR.
