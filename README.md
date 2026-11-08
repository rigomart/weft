# vita-next

Working name for the successor to Vita OS (`~/projects/vita-os`). Vita OS stays in use as the reference until this replaces it, then it is sunset.

The starting point: Vita OS stores a life as a tree of containers (Threads holding Tasks and Notes), but a life is a web. Here, everything is an **entry** that can connect to any number of **Threads** and to other entries, and the Dashboard stays the main view.

## Where things are

- `docs/research/2026-11-08-data-shape-analysis.md`: the diagnosis, the six cases that tested it, and the proposal.
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
