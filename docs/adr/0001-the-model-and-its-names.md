# The model and its names

**Status:** Accepted
**Date:** 2026-11-08

Weft replaces Vita OS's tree of containers (Threads holding Tasks and Notes) with one kind of thing that can belong to several Threads. The research and prototypes behind this are in `docs/research/2026-11-08-data-shape-analysis.md` and `prototype/`. With an event log (ADR 0002), names are stored in events forever, so they are settled before any schema exists. `GLOSSARY.md` is seeded from this ADR when the first code lands.

## Decision

**Entry**: anything captured: a thought, a fact, something that happened, or something to come back to. Valid as soon as it is saved, with nothing to classify.
_Avoid_: note, item, task, moment

**Thread**: an ongoing situation or concern that Entries are on, either Open or Resolved.
_Avoid_: project, group (except as interface copy in the workspace), area, folder

**Update**: an Entry added to an earlier Entry to say what happened next, so the two read as one story: the insurance claim, the call, the form, the approval.
_Avoid_: reply, step, child, chain (except in code comments explaining the structure)

**Follow-up date**: a calendar day, with an optional time of day, on which an Entry comes back to the glance view. Soft: it never nags and is never a deadline.
_Avoid_: due date, deadline, reminder, ask

**Repeat**: an optional rhythm on a Follow-up date. Completing a repeating Follow-up date moves it to its next occurrence; missed occurrences collapse into one.
_Avoid_: recurrence, routine, habit

**Complete**: to say a Follow-up date has been dealt with; the date clears and the Entry stays as a record.
_Avoid_: done, handle, check off, archive

**Loose**: an Entry on no Thread. Loose is a fine place to stay.
_Avoid_: inbox, unsorted, standalone, unprocessed

**Put away**: to take an Entry out of the glance and workspace views without deleting it. It stays in History and can be brought back.
_Avoid_: archive, hide, trash

**Resolve**: to close a Thread that no longer needs attention. It can be reopened.
_Avoid_: complete, done, close

**Suggestion**: the app proposing that an Entry belongs on a Thread, or with another Loose Entry.

### Relationships

- An **Entry** is on zero or more **Threads**. Most are on one.
- An **Entry** has zero or one parent Entry; an **Update** is an Entry with a parent. An Update is on its first Entry's Threads, never on Threads of its own.
- An **Entry** has zero or one **Follow-up date**, which may have a **Repeat**.
- An **Entry** has a body and the instant it was written.
- An **Update** is made by an action, never by drawing a link: completing a Follow-up date and saying what happened, adding an Update, or pulling part of an Entry out.
- A **Thread** needs only a name, and can be started from Entries that already exist.
- Completing a **Follow-up date** may add an **Update** saying what happened.
- Accepting a **Suggestion** puts the Entry on the Thread, or groups the two Loose Entries in a new Thread. The app never files anything on its own.
- A **Thread** with nothing asking is valid, as is a **Loose** Entry.

### What is not in the model

- **Areas.** Vita OS's optional label on a Thread is dropped; the owner rarely uses it. A filter label can be added later cheaply.
- **Sharing.** One person owns all of their data; no Thread is shared.
- **Free links between Entries.** Only Suggestions pair Entries, and accepting one groups them.
- **Priorities, subtasks, statuses beyond Open and Resolved.** The Vita OS thesis filter still applies.

## Open

- The names of the three views (quick glance, the middle view, History). Interface copy only, cheap to change.
- How an Entry on several Threads is shown in the middle view. The prototype shows it in full on its first Thread and as a one-line reference elsewhere; the owner is not convinced yet.

## Considered Options

- **Keep Vita OS's words** (Note, Task, Standalone Note). They carry the old model: a Task is a to-do, and Note against Task is the split this project removes.
- **Neutral names in code, mapped to interface words.** Two vocabularies forever.
- **"Follows from" for Updates.** Collides with "Follow-up date"; Updates are described as added to an Entry instead.
