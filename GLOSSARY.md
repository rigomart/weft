# Weft

Weft keeps one person's life as Entries on Threads, with Follow-up dates that bring Entries back when they matter. These are the names for its concepts in conversation, issues, code, tables, events and interface copy. Seeded from ADR 0001.

## Language

### What is kept

**Entry**:
Anything captured: a thought, a fact, something that happened, or something to come back to. Valid as soon as it is saved, with nothing to classify.
_Avoid_: note, item, task, moment

**Thread**:
An ongoing situation or concern that Entries are on. A Thread is either Open or Resolved.
_Avoid_: project, group (except as interface copy in the workspace), area, folder

**Update**:
An Entry added to an earlier Entry to say what happened next, so the two read as one story: the insurance claim, the call, the form, the approval.
_Avoid_: reply, step, child, chain (except in code comments explaining the structure)

**Loose**:
Said of an Entry on no Thread. Loose is a fine place to stay.
_Avoid_: inbox, unsorted, standalone, unprocessed

**Suggestion**:
The app proposing that an Entry belongs on a Thread, or with another Loose Entry.

### Coming back to things

**Follow-up date**:
A calendar day, with an optional time of day, on which an Entry comes back to the glance view. Soft: it never nags and is never a deadline.
_Avoid_: due date, deadline, reminder, ask

**Repeat**:
An optional rhythm on a Follow-up date. Completing a repeating Follow-up date moves it to its next occurrence; missed occurrences collapse into one.
_Avoid_: recurrence, routine, habit

### Actions

**Complete**:
To say a Follow-up date has been dealt with. The date clears and the Entry stays as a record.
_Avoid_: done, handle, check off, archive

**Put away**:
To take an Entry out of the glance and workspace views without deleting it. It stays in History and can be brought back.
_Avoid_: archive, hide, trash

**Resolve**:
To close a Thread that no longer needs attention. It can be reopened.
_Avoid_: complete, done, close

## Relationships

- An **Entry** is on zero or more **Threads**. Most are on one.
- An **Entry** has zero or one parent Entry. An **Update** is an Entry with a parent. An Update is on its first Entry's Threads, never on Threads of its own.
- An **Entry** has zero or one **Follow-up date**, which may have a **Repeat**.
- An **Entry** has a body and the instant it was written.
- An **Update** is made by an action, never by drawing a link: completing a **Follow-up date** and saying what happened, adding an Update, or pulling part of an Entry out.
- A **Thread** needs only a name, and can be started from Entries that already exist.
- Accepting a **Suggestion** puts the Entry on the Thread, or groups the two **Loose** Entries in a new Thread. The app never files anything on its own.
- A **Thread** with no **Follow-up date** on any of its Entries is valid, as is a **Loose** Entry.

## Flagged ambiguities

- The three views have working names only: the glance view, the workspace and History. Open: their names in the interface (ADR 0001, interface copy only).
