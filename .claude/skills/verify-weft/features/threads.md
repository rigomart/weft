# Threads

A Thread needs only a name and is Open or Resolved. Threads are started and given Entries from [the entry panel](entry-panel.md)'s Threads section, and open in the same side panel.

The entry panel's Threads section lists each Thread the Entry is on as a chip with a × (`button "Take off \"<name>\""`), or "Loose. That's fine." when there are none. Under it, `combobox "Put on a thread"` lists the Threads the Entry is not on whose name contains what is typed, open ones first, then `Start "<typed>"` unless a Thread already has that exact name. Enter picks the first. Picking a Thread writes one "entry put on thread"; Start writes "thread started", then "entry put on thread". × writes "entry taken off thread". An Entry can be on several Threads. Naming an Update acts on its first Entry.

On [Now](now.md), each row in a group shows a chip per Thread its Entry is on (`button "Open thread \"<name>\""`), or a plain "Loose" chip. Each Thread keeps one colour. A resolved Thread's chip is dimmed and says "resolved" (its button name ends ", resolved"). Clicking a chip opens the Thread without opening the row. Beside the groups, under Loose, the Quiet threads list holds the open Threads with nothing asking (no Entry on them shows on Now with a Follow-up date), most recently active first: each with its chip and "last <day>", the day an Entry on it was last written or completed, or "nothing on it yet".

The thread panel (`complementary "Thread <name>"`) shows "Thread" with its colour, a × , the name (`textbox "Thread name"`), renamed with one "thread renamed" on Enter or when the field loses focus (an emptied name comes back), then "Open" with Resolve, or "Resolved <day>" with Reopen. Escape closes it.

## Entry points and variants

- The entry panel's Threads section, for an Entry on no Thread and on several
- A chip on a Now row, and a Quiet threads row
- Typing a new name, part of an existing name, and an existing name exactly
- Quit and relaunch

## Preconditions

- A new instance name, connected with agent-browser
- Capture "Dentist: grinding teeth, night guard, asked if I'm stressed." with a Follow-up date in two weeks, "Book the checkup" today and "Desk chair?" with no date

## Checks

Read Now with `JSON.stringify([...document.querySelectorAll('[role=tabpanel]:not([inert]) section')].map(s => [s.querySelector('h2').firstChild.textContent, s.querySelector('h2').lastChild.textContent, [...s.querySelectorAll('[role=listitem]')].map(i => i.innerText)]))`.

1. Open the dentist entry. In `combobox "Put on a thread"`, type "Teeth" and press Enter; then "Sleep", then "Work stress". The panel's chips are `["Teeth","Sleep","Work stress"]`, the field is empty again, and the dentist row on Now reads `…stressed.\nTeeth\nSleep\nWork stress\nNov 20`. The log ends with three pairs of "thread started" and "entry put on thread". "Book the checkup" reads `Book the checkup\nLoose`.
2. Click the "Sleep" chip on the dentist row: the thread panel opens (`aria-label` `Thread Sleep`) with "Open" and Resolve. Fill the name with "Sleep quality" and press Enter: one "thread renamed". Resolve: the panel shows "Resolved <today>" and Reopen, and the row's chip button is named `Open thread "Sleep quality", resolved`. Reopen: the ", resolved" is gone.
3. Fill the name with spaces and press Enter: it reads "Sleep quality" again, and no "thread renamed" is added. Escape closes the panel.
4. Open "Desk chair?" and start "Home" from the field: Loose is empty, and Quiet threads is `["Quiet threads","1",["Home\nlast Nov 8"]]` (today). Clicking it opens the thread panel on Home.
5. Open "Book the checkup", type "tee": the visible options are `["Teeth","Start “tee”"]`. Enter puts it on Teeth; `button "Take off \"Teeth\""` takes it off, and the section says "Loose. That's fine." The last two events are "entry put on thread" and "entry taken off thread".
6. After `verify down` and `verify up`, Now reads the same.
7. `verify doctor` is `ok` with `windowMessages` `[]`, and `grep -c "^Weft failed" <appLog>` prints `0`.

## Not covered

- The Thread's story, in [A Thread's story](thread-story.md); Updates' Threads, in [Updates](updates.md).
- A refusal or failure, which the window cannot cause. The panel shows `Weft refused this change: …` or `Weft couldn't save this change: …`.

## Traps

- The Put on a thread list stays in the DOM when closed. Read the options with `checkVisibility()`.
