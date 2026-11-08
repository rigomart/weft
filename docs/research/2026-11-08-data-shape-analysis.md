# Why Vita OS's data shape feels wrong

> 2026-11-08. Written while Vita OS was in daily use. Vita OS (`~/projects/vita-os`) is the reference; this project is meant to replace it.

## The itch

Vita OS works and gets used daily, but the data shape and the way things are captured never felt right. Two hunches:

- a completely different way to see and connect things, "kinda like a graph";
- an excalidraw-like workspace where random thoughts and things happening in life are dropped in and connected, and the app arranges them.

## Diagnosis

**The model is a tree; a life is a web.** Every Vita OS object is a container or lives in one. A Thread holds Tasks, Thread Notes and an Activity Log. A Note is inside exactly one Thread or outside all of them. The repo shows the strain in four places:

1. **One thing, four types.** The same sentence can be a Standalone Note, a Thread Note, a Task or a Thread title. Which one depends on where it lives, not on what it is. The conversion rules are intricate: adding a dated Note to a Thread turns its first line, Markdown stripped, into a Task carrying its date. A Thread Note can never be completed; the same text as a Standalone Note can. Rules this intricate usually mean the types are views of one thing.
2. **A thing belongs to one Thread, once.** Adding a Note to a Thread is one-way, and a Thread Note can't join a second Thread.
3. **The story has to be rebuilt.** ADR 0053 and 0054 work hard to get a story back out of the Activity Log: Started lines, Notes in the log, folding repeats. The model keeps the pieces. The story lives in how they connect and in what order, and the model doesn't hold that.
4. **Threads are declared up front.** A situation often first appears as a few unrelated-looking notes.

## The cases

Six made-up but realistic cases, chosen to stress the diagnosis. Two are controls where Vita OS should win. The owner confirmed that several of them, especially the health ones, have happened or will happen.

### 1. The back pain that became a thing

Three loose Notes over a month ("back stiff after the drive", "desk chair?", "couldn't sit through the movie"), then the realisation that this is a situation.

Vita OS handles a Thread created late: each Note can be added from its Note view, keeping its creation time. The gap is **recall**: nothing says "this looks like the Note from Sep 3". A graph doesn't fix that by itself; suggestions do, and they could be added to the current model too.

### 2. The dentist note that belongs to three Threads

"Dentist: I'm grinding my teeth, recommends a night guard, asked if I'm stressed." It matters to Teeth, Sleep and Work stress. Vita OS gives it one home. Weeks later the Sleep Thread's story lacks its best clue. Copying the text drifts.

### 3. A parent's blood pressure

A slow situation: checkup, cardiology visit, new medication, dated follow-up in three months. Along the way a "dizzy in the mornings" Note is captured on the bus as a Standalone Note and never filed. An insurance rejection with an appeal date lands in an Admin Thread. On follow-up day, the story needed before calling the doctor is spread across three places.

It shows two things: a thing can belong to several Threads, and the story crosses Threads. It also adds a finding: **capture on the go lands loose, and the later filing step is where things get lost**, in any model that relies on filing later.

### 4. The leak that turned into a project

"Call plumber about the leak", dated Thursday, completed after the visit. That evening the pipe needs replacing and a quote is coming: now it's a situation. A Completed Note can't start a Thread, so it is reopened, a Thread started from it, and the rule turns its first line into a dated Task for a call already made, which is then deleted.

The text didn't change; what it *was* changed, and the conversion left debris behind.

### 5. The good day

"Hiked with a friend, felt calm for the first time in weeks. Should do this more."

It's a Standalone Note with no date. It asks for nothing. Completing it is meaningless and leaving it open grows a pile. Nothing links it to Sleep, Work stress or Back pain.

**This may be the core of the itch.** Vita OS is built to hold *open loops* ("what is open, and what is asking now?"). The excalidraw wish was about "random thoughts or things happening in my life". One is a to-do system that never nags; the other is a map of a life. The current shape only has a real place for the first.

### 6. Control: the car decision and the Sunday plants

A self-contained "Replace the car" Thread (comparisons, a test drive, resolved), and a Task repeating every Sunday. Both work cleanly today. A graph adds nothing, and drawing a rhythm as 52 dots a year would hurt. **Whatever replaces Vita OS must keep these as good as they are.**

## Scorecard

| Finding | Cases | Verdict |
| --- | --- | --- |
| A thing belongs to several Threads (tree vs web) | 2, 3 | Holds; health cases make it frequent |
| One thing, many types; conversions leave debris | 4 | Holds; friction rather than crisis |
| The story crosses Threads | 3 | Holds |
| Threads declared up front | 1 | Weak; the real gap is recall |
| Filing later is where things get lost | 3 | Holds for any model; only suggestions help |
| Vita OS holds open loops; the owner also wants to hold life | 5 | Possibly the core |
| Self-contained Threads and rhythms already work | 6 | Keep them |

## Proposal

### Shape

- **One kind of thing: an entry.** A thought, an event, a fact or an intention. A body, the time it happened, and an optional date to bring it back. An entry with a bring-back date is what Vita OS calls a Task or a dated Note; an entry without one is a record or a life moment. Handling an entry clears its ask and keeps it as a record, so nothing converts.
- **Connections.** Untyped and optional. An entry can connect to any number of Threads and to other entries. An unconnected entry is fine, as a Thread with no Tasks is fine today.
- **A Thread is a named cluster**: a line that entries sit on. It can be named after its entries exist.
- **Rhythms stay rhythms.** A repeating Task belongs to its Thread and is never drawn as one entry per occurrence.
- **Suggestions, never filing.** When an entry lands, the app proposes connections (shown dashed). The owner accepts or ignores them; nothing is filed on its own.

### Views

- **The Dashboard stays the main view.** It answers "what is asking now?" from bring-back dates, as today. It is the right-hand edge of the map, read as a list.
- **A map as the second view.** Candidate shapes, to be chosen by using them (see `prototype/`):
  - **Lanes:** time runs left to right and each Thread is a lane. An entry on two Threads sits across both lanes like a metro interchange. New captures land at "now" in a loose band. Position is derived, never placed by hand.
  - **Canvas:** the excalidraw wish as described: cards on a free surface, connected by lines, arranged by the app.
  - **Focus:** one entry or Thread in the middle with its neighbours around it, and its story beside it, including entries shared with other Threads.

### Risks

- **The hairball.** Connections only earn their place if they come back when needed: reopening a Thread after weeks, or a new capture that says "this looks related to X". If connecting becomes a hobby, the graph becomes noise.
- **Upkeep.** Hand-placing things on a canvas is maintenance, which the Vita OS thesis rules out ("costing almost nothing to keep").
- **Scope creep.** Holding life moments as well as open loops may turn a focused tool into a journal. The boundary needs deciding, not drifting.

## Open questions

- Is the successor an open-loop holder that also accepts life moments, or a life map that also holds open loops? The Dashboard answer differs.
- Do Areas survive, or are they simply long-lived Threads?
- What does a suggestion engine need to be useful: words, people, places, time proximity?
- What carries over from Vita OS unchanged: soft dates, colour belonging to time, missed repeats collapsing, the Thesis as a Filter.

## Addendum: relationships between entries

Asked after the second prototype round: besides belonging to threads, do entries connect to each other in real use?

| Case | Relationship | Verdict |
| --- | --- | --- |
| Insurance claim: rejected, called, sent form, approved | Each answers the one before | Real and common: a chain |
| Plumber: call, visit, quote, fixed | The outcome of an ask | Real; Vita OS already has it as a completion note |
| Cardiology visit note with one line that is an ask | A piece pulled out of an entry | Real: a split, which also makes a chain |
| Job search, one story per company | Looks like sub-threads | Covered by chains inside one thread |
| "This reminds me of that" | Free association | Real as a thought, never maintained by hand; leave it to suggestions |

So the model keeps two relationships: an entry is **on** any number of threads, and an entry may **follow from** one earlier entry. Chains are created by actions (handling an ask, adding an update, splitting), and a chain belongs to its first entry's threads.

A chain also solves most of the duplication in a grouped view: a chain is one card. An entry on several threads shows in full in the first and as a one-line reference elsewhere.

**Open:** when a thread holds a single story (the car decision), its entries are already a chain in all but name. Whether to make every entry in such a thread a reply, or leave chains for threads that hold several stories, is unsettled.
