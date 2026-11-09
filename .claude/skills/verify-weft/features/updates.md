# Updates

An Update is an Entry added to an earlier one to say what happened next. It is made by an action, never by drawing a link.

[The entry panel](entry-panel.md) has a "What happened next?" box (`textbox "What happened next?"`) with its own "Bring back…" day and "Add update" (off while the box is empty; ⌘Enter adds too). Adding writes one "entry written" whose `parentEntryId` is the open Entry, then one "follow-up date set" when a day was chosen, and the panel moves to the new Update.

Completing a Follow-up date, by ✓ on Now or Complete in the panel, opens the panel on that Entry with the same box as "What happened?" (`textbox "What happened?"`), focused. Save adds an Update as above. "Nothing to add" turns the box back into "What happened next?" and writes nothing. The completion itself is already stored by then.

An Update's panel is titled "Update · <day>" and starts with "Follows from <the Entry it was added to>", a button that opens that Entry. Once an Entry has Updates, the panel lists the whole story under "Story · <count>": the first Entry, then each Update under the one it follows, by when it was written, indented only where an Entry has several. Each line shows its Follow-up date (marked ○) or, for a completed one, ✓ and the day it was completed, else the day it was written; the open Entry is marked (`aria-current="true"`), and clicking a line opens it. An Update's Threads section says "An update is on the threads of the entry it started from." with those Threads' chips, or "Loose, like the entry it started from.", and offers no picker or ×.

On [Now](now.md), an Update with a Follow-up date shows "↳ <the first Entry's body>" under its own, and its first Entry's Thread chips. Updates are never in Loose.

## Entry points and variants

- ✓ on a Now row, and Complete in the panel
- "What happened next?" with and without a day
- "Nothing to add"
- The "Follows from" link and a Story line
- Quit and relaunch

## Preconditions

- A new instance name, connected with agent-browser
- Capture "Call about the claim" for yesterday, open it and start the Thread "Insurance" from its Threads section, then close the panel

## Checks

1. ✓ on "Call about the claim": the panel is `Entry · Nov 8` with "Completed Nov 8, kept as a record", the box reads "What happened?" and has focus.
2. Type "Rejected, appeal by the 20th", choose a day two weeks out in the box's "Bring back…", Save. The log ends with "follow-up date completed", "entry written" with `parentEntryId` the claim's `entryId`, and "follow-up date set" with that day. The panel is `Update · Nov 8`, starts "Follows from Call about the claim", and its Story is `Story · 2`: `Nov 8 ✓ Call about the claim`, then `Nov 22 ○ Rejected, appeal by the 20th` (current). Its Threads section shows the claim's Insurance chip and no picker.
3. Now shows `["Later","1",["Rejected, appeal by the 20th\n↳ Call about the claim\nInsurance\nNov 22"]]`.
4. "Follows from Call about the claim" opens the claim, whose Story marks it current. Type "Called them again" in "What happened next?" and press ⌘Enter: the panel moves to it, and the Story lists the two Updates indented one step under the claim.
5. Capture "Stretch" today, ✓ it, then "Nothing to add": the box reads "What happened next?" with Add update, and the log ends with "follow-up date completed", with no "entry written" after it.
6. Open "Rejected, appeal by the 20th" and press Complete in the panel: the box reads "What happened?" and has focus.
7. After `verify down` and `verify up`, Now reads the same.
8. `verify doctor` is `ok` with `windowMessages` `[]`, and `grep -c "^Weft failed" <appLog>` prints `0`.

## Not covered

- Pulling part of an Entry out, in [Pull out selection](pull-out.md), and the Thread's story (#16).
- A refusal while adding, which the window cannot cause. The box shows `Weft refused this update: …` or `Weft couldn't save this update: …`.

## Traps

- With an Update open that has no Follow-up date, the panel has its own "Bring back…" too, before the box's. Pick the one you mean by ref, or close the panel before capturing.
- A Now row's centre can fall on a Thread chip, which opens the Thread. Open a row by `focus` on `button "Open \"<body>\""` and Enter.
