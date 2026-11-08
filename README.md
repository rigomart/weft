# Weft

The successor to [Vita OS](https://github.com/rigomart/vita-os). Vita OS stays in use as the reference until this replaces it, then it is sunset.

The starting point: Vita OS stores a life as a tree of containers (Threads holding Tasks and Notes), but a life is a web. Here, everything is an **Entry** that can be on any number of **Threads**, an Entry can carry **Updates** saying what happened next, and the quick-glance view (Vita OS's Dashboard, ported) stays the main view. The data lives on the person's device, with optional end-to-end encrypted sync through Cloudflare.

## Where things are

- `docs/research/2026-11-08-data-shape-analysis.md`: the diagnosis, the six cases that tested it, and the proposal.
- `docs/decisions/2026-11-08-foundations.md`: three options for each decision that is costly to change, with the reasoning.
- `docs/adr/`: the decisions themselves.
- `GLOSSARY.md`: the model's names, seeded from ADR 0001.
- `AGENTS.md`: how to run the checks and where each workspace's responsibility ends.
- `prototype/index.html`: a clickable prototype with no build step. Open it in a browser.

## Prototype rounds

Round 1 compared a time-shaped Dashboard, lanes, a free canvas and a neighbourhood view. Settled:

- **Now** (the Dashboard, built from entries) is the main view.
- **History** is the lanes view: reviewing in detail what happened and what's next. It is not for arranging.
- The free canvas felt closest to the arranging, grouping and trimming wanted, but too loose.

Round 2 varies only the **Workspace** (`?tab=work&variant=…`, `[` and `]` step through):

- `canvas`: round 1's free canvas, kept as the reference.
- `islands`: each thread is a group the app lays out; you choose membership, group order, folding and putting away.
- `columns`: one column per thread, Loose first.
- `desk`: loose cards on a desk, threads as trays, keyboard sorting.

Every workspace shares one rule: dragging a card moves it, and holding ⌥ while dropping also keeps it where it was. Dropping a card on another loose card starts a group.

Round 3 settles the Workspace as **islands** and varies only how a chain card reads (`?variant=stack|latest`):

- An entry can follow from one earlier entry ("what happened next"). Chains are made by handling an ask, adding an update, or pulling part of an entry out; never by drawing lines. A chain is one card and belongs to its first entry's threads.
- An entry on several threads shows in full in the first one and as a one-line ↗ reference in the others.
- Free-form links between entries are gone; only suggestions pair loose entries, and accepting one groups them.
- Columns, desk and the free canvas are in the round 2 commit.
