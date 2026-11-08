# Foundations: the decisions that are costly to change

> 2026-11-08. **Settled.** The decisions are ADRs 0001 to 0009 in `docs/adr/`, which win where they differ from this comparison. Package numbers come from `depfit` run on 2026-11-08.

Settled before this document: a desktop app that keeps data on the person's device, with optional sync to our own infrastructure; Cloudflare for anything in the cloud; a plain shadcn/ui look with no styling work for now; Vita OS (`~/projects/vita-os`) as the reference, its Dashboard ported as the glance view.

Answers from the owner (2026-11-08):

1. **A phone app: maybe.** It would be its own app with its own interface, sharing the rules, storage and sync code (see point 3).
2. **Servers must not read a person's data.** Go with end-to-end encryption (point 4).
3. **No sharing, ever.** One person per log (point 5).
4. **Areas are dropped.** The owner rarely uses them (point 10).

---

## 1. Where the truth lives, and what is stored

| | Option | For | Against |
| --- | --- | --- | --- |
| A | **The server holds the truth; desktop caches it** (Vita OS today) | The simplest way to handle conflicts; reuses Vita OS's API and storage | Not local-first: offline is second-class and using the app needs an account. Vita OS ADR 0042 rejected adding sync to this shape as too large |
| B | **Local tables are the truth; sync exchanges changed rows** (each row has an updated time; deletes leave a marker; the last edit per field wins) | A normal schema with normal migrations and queries | History is not kept, so it has to be bolted on as a log next to the data. That is the Vita OS Activity Log problem again (ADR 0053, 0054) |
| C | **An append-only event log is the truth; tables are built from it** ("entry added", "ask handled", "put on thread") | History comes free and is exact. Merging two devices is combining two logs. Undo is cheap. The tables can be thrown away and rebuilt, so the model can keep changing while it is being found | Events are permanent: changing their shape means versioning events, not migrating tables. It needs more design up front, and rebuilding gets slower as the log grows (snapshots fix that later) |

**Recommendation: C.** History is a product view here, not an afterthought, and the model is still moving. Being able to rebuild the tables from the log is the main point: a wrong table design costs a rebuild, not a migration. Merging is trivial for one person on a few devices. To keep the cost down: a small set of coarse events, a version number on every event from the first commit, and event names taken from the glossary (point 5).

## 2. Who builds the sync

| | Option | depfit | For | Against |
| --- | --- | --- | --- | --- |
| A | **LiveStore** (an event-sourced SQLite library with a Cloudflare sync backend) | 0.5.0, 68 packages, 127.9 MB, needs Effect 4, 3 vulnerabilities in its dependencies, 2,273 commits last year | Exactly the shape of point 1C, already built | Before 1.0, so its API will keep breaking; heavy; the whole app gets tied to Effect |
| B | **TinyBase** (a reactive store with SQLite storage and a Durable Object synchronizer) | 10.0.1, 1 package, 16 MB, MIT, 37 releases last year | Light, mature, and its sync runs on Cloudflare | It syncs current state, not events, so it goes against 1C and history would be built separately |
| C | **Our own**: an event table in local SQLite, plus one Durable Object per person that stores the events in its own SQLite and hands them out by sequence number | No dependency | For one person this is small: events are idempotent by ID, the server assigns the order, and clients fetch everything after the last number they saw. It runs on Cloudflare and we control it fully | We write and test it: ordering across devices (a hybrid clock), retries, and the first full download |

Out of the running: **Replicache** (its repository is archived, no release in 494 days) and **Automerge** (a document CRDT for editing text together, 47.5 MB, built for a different problem).

**Recommendation: C.** Sync for one person over an append-only log is a few hundred lines, not a research project, and it avoids building on a pre-1.0 library. With sharing ruled out, it stays that small. B would mean less sync code, but only by giving up the event log of point 1, so history would have to be built separately again.

## 3. Where the database runs, and which desktop shell

| | Option | depfit | For | Against |
| --- | --- | --- | --- | --- |
| A | **Electron, with SQLite in the main process** (Vita OS ADR 0042) | electron 45.2.3, very active. Drivers: `@libsql/client` (14 packages, 11.4 MB, proven in Vita OS), `node:sqlite` (built in, nothing to install) | Proven in Vita OS, along with its release work (ADR 0043). The data is a real file on disk, covered by the computer's own backups | Tied to Node. A phone or web version could not reuse the storage code |
| B | **SQLite compiled to WebAssembly, inside the page** (`@sqlite.org/sqlite-wasm` with browser file storage) | 1 package, 3.0 MB, Apache-2.0, active | The same code could run as a website, an installable web app, or a phone app later | The data sits inside the browser engine's own storage, not as a visible file, which makes backups less obvious. Setting up its background worker is fiddly |
| C | **Tauri, with SQLite on the Rust side** | `@tauri-apps/api` 2.12.4, 1 package, 892 KB | A much smaller app. Tauri 2 can also build iOS and Android apps | A Rust side that Vita OS does not have, and database access over a plugin bridge. Little of Vita OS's desktop work carries over |

**Recommendation: A, with the storage behind a small database seam.** If the event log and the table-building code only ever talk to that seam (as Vita OS's operations talk to theirs), a phone or web host later means writing a second seam implementation, not a rewrite. For the driver, start with `@libsql/client`, since it is proven in this exact setup, and look again at `node:sqlite` when the seam exists.

**A phone app does not change this.** A phone wants its own interface anyway, so a later phone app would be React Native with its own screens. It would reuse `core` and `store` with a phone SQLite driver behind the same seam, and run the same sync. Tauri was only attractive for reusing one interface everywhere; that matters less than reusing the rules and sync, which this split already does. A native Swift app would have to rewrite the rules, so React Native is the better fit for a TypeScript core. The constraint this puts on the code now: `core` and `store` use no Node-only APIs, and encryption sits behind a small seam too, because React Native does not ship the browser's WebCrypto.

## 4. Privacy of synced data

| | Option | For | Against |
| --- | --- | --- | --- |
| A | **The server can read it** (Cloudflare encrypts it on disk by default) | Simplest. Server-side features (AI, search, a web view) just work | Anyone with access to the infrastructure, or a breach, can read health notes about the person and their family |
| B | **End-to-end encrypted.** The device encrypts each event's content with the built-in WebCrypto API; the server stores sealed blobs plus only the ID, order and device | The server cannot read anything. With 1C and 2C it costs little, because the server only passes events along and never needs to understand them | A lost key loses the cloud copy (the device copy is fine). Setting up a new device needs a recovery code. Nothing smart can run on the server |
| C | **Encrypted, with features run from the device.** As B, but features that need the content run on the device and call outside services directly (for example AI suggestions sent straight to the model's API) | Keeps B's guarantee for storage while leaving room for smart features | Each such feature sends content off the device, so each needs its own clear consent |

**Decided: B, leaving room for C later.** Encryption is close to impossible to add once data sits unencrypted on a server, and the event relay makes it cheap today. Use WebCrypto, which is built in, rather than `libsodium-wrappers` (2 packages, 1.8 MB), behind a small seam (see point 3). The hard part is the recovery code, not the cryptography: it is shown once when sync is turned on, a new device needs it, and losing it loses only the cloud copy.

## 5. Sharing

| | Option | For | Against |
| --- | --- | --- | --- |
| A | **Never: one person per log** | Simplest sync, permissions and encryption | Sharing a parent's Thread with a sibling would mean redesigning sync and keys later |
| B | **One person for now, with a "space" on every event** (a space is one log with its own key; everyone starts with one personal space) | Costs one field per event and one key per space. A Thread could later move into a shared space | A little more to think about in the sync code from day one |
| C | **Shared from the start** (several people, permissions, real-time merging) | Ready for family use | Much more sync and permission work before anything useful exists |

**Decided: A.** Sharing is not planned, so every event belongs to the one person whose log it is, and there is one encryption key per person.

## 6. Names

| | Option | For | Against |
| --- | --- | --- | --- |
| A | **Keep the Vita OS words** (Thread, Note, Task, Follow-up date, Area) | Familiar, with a glossary already written | The words carry the old model: "Task" means a to-do, and Note vs Task is the split this project removes |
| B | **A new glossary for the new model** (Entry, Thread, Update, a word for the bring-back date, Loose, Put away, Resolve) | One concept, one name, in the interface, the code, the tables and the events alike, as Vita OS's own rule says | The words have to be chosen before the schema and events exist |
| C | **Neutral words in code** (item, group, link), with the interface's words mapped onto them | Renaming the interface later is cheap | Two vocabularies to translate between forever, which Vita OS's naming rule exists to prevent |

**Recommendation: B, written as `CONTEXT.md` before any schema.** With an event log the names are stored forever. Words still to choose: the bring-back date (we have been saying "ask"), the update relationship, and the three views (those are interface-only and cheap to change).

## 7. Dates and times

| | Option | For | Against |
| --- | --- | --- | --- |
| A | **Everything as a UTC timestamp**, with a day stored as local midnight (Vita OS ADR 0027) | One type | A day drifts when the person travels or the clocks change, and "midnight means no time" is a convention every reader has to know |
| B | **Two kinds of value.** Moments that happened are UTC instants. Bring-back dates are a calendar date (`2026-11-15`) with an optional local time (`09:30`). Repeats count calendar days | Matches the meaning: a bring-back date is a day, not an instant. Safe across travel and clock changes | Two types to handle, and conversions at the edges |
| C | **A full date-time with a time zone everywhere** (an IANA zone stored with every value) | The most exact | Heavy for what this app needs, and the zone of a bring-back date is rarely meaningful |

**Recommendation: B.** It carries over what Vita OS learned ("a time orders, never places") without the midnight trick.

## 8. Attachments (not built yet, but the shape is reserved)

| | Option | For | Against |
| --- | --- | --- | --- |
| A | **No attachments**; text and links only | Nothing to build | Health cases include prescriptions, lab results and letters, so people would end up storing them elsewhere |
| B | **Files stored by content hash**: kept on disk under their SHA-256, synced to Cloudflare R2 (encrypted under 4B), with entries pointing at the hash | Duplicates are stored once, the event log stays small, and it fits R2 | A second sync path for files |
| C | **Files stored inside the database or the events** | One place for everything | The log and every sync grow with every photo |

**Recommendation: B, reserved now and built later.** Define an "attachment added" event (hash, name, size, type) so no events need versioning when attachments arrive. Also settled, from the prototypes: an entry may be on several Threads, may follow from one earlier entry, and may have a bring-back date with a repeat.

## 9. How the code is split

| | Option | For | Against |
| --- | --- | --- | --- |
| A | **One app package** | Fastest start | Rules mix with UI and storage, and a second host (phone, web, sync worker) means pulling them apart later |
| B | **A monorepo like Vita OS (Bun + Turbo)**: `core` (rules, event definitions, building tables from events; no framework code), `store` (the database seam, event log, sync client), `app` (React and shadcn), `desktop` (the Electron host), `sync` (the Worker and Durable Object) | Proven in Vita OS: it survived a move from Convex to Cloudflare and gained a desktop host without its rules being rewritten. The rules can be tested without UI or a database | More setup at the start |
| C | **Only `core` and `app`, with thin hosts** | Lighter than B | Storage and sync code ends up in the app or the desktop host, which is where Vita OS put it at first and later had to move it out (ADR 0042) |

**Recommendation: B.** It is the one Vita OS converged on, and it is what makes points 3 and 1 portable.

## 10. Coming from Vita OS, and Areas

| | Option | For | Against |
| --- | --- | --- | --- |
| A | **Drop Areas** | A smaller model | Loses a filter that may be in daily use, and the Area labels in existing data |
| B | **Keep the Area as an optional label on a Thread** (as Vita OS does now) | Keeps the data and the glance filter, and is cheap to drop later | One more concept in the glossary |
| C | **Make each Area a Thread**, with its Threads' entries also placed on it | Uses only the new model's pieces | Floods the Area Threads with entries and blurs what a Thread is |

**Decided: A, plus a one-time importer.** The owner rarely uses Areas, and a filter label can be added later cheaply. The importer maps Vita OS data like this:

- Threads become Threads.
- Thread Notes become entries on their Thread.
- Tasks become entries with a bring-back date.
- Completion notes become updates.
- Standalone Notes become loose entries.
- The Activity Log becomes the events it describes, where they can be recovered.

It runs once, into an empty database, the way Vita OS imports into desktop (ADR 0042).

---

## Cheap to change later

Branding and visual design, the names of the three views, auto-update, code signing, Windows and Linux builds, search (SQLite's built-in full-text search), AI suggestions, the final shape of the middle view.
