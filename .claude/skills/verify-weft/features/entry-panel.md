# The entry panel

Clicking an Entry's row on [Now](now.md), in a group or in the Loose list, opens it in a side panel on the right of the window (`complementary` named by its title). Each row has a button over it, `button "Open \"<body>\""`; its ✓ stays above that button and completes without opening anything. The open row is outlined. The panel narrows Now, which keeps its two columns.

The panel's title reads "Entry · <written day>", with " · put away" when the Entry is put away, beside a × (`button "Close"`). Under it:

- The body (`textbox "Body"`), saved as one "entry edited" when the field loses focus or the panel closes with an edit in it. An emptied body is not saved and comes back.
- With a Follow-up date: "Comes back", the day as a row names it (`button "Thu"`), the Time and Repeat fields as in [Capture an entry](capture-an-entry.md) and [Repeat a follow-up date](repeat-a-follow-up-date.md), then Complete and No date. Each change writes one "follow-up date set" with the whole Follow-up date; No date, or "No date" in the day's popover, writes "follow-up date cleared". A Repeat choice that cannot be one yet (Weekly with no weekday) writes nothing until it can.
- Without one: "Bring back…", which sets a day with no time and no Repeat.
- After a completion: "Completed <day it was completed>", with ", kept as a record" when no Follow-up date is left, and Undo, which sets the completed Follow-up date again and so clears the completion. Setting or clearing a Follow-up date also clears it.
- Put away, or Bring back when it is put away. Putting away keeps the panel open on the Entry, so it can be brought back; the row leaves Now.
- Delete, which asks "Delete this entry?" ("Its updates stay, attached to what it followed from.") with Cancel and Delete. Deleting writes one "entry deleted" and closes the panel.

Escape closes the panel, saving an edit in the body first, unless a popover, a list or the dialog is open: then Escape closes only that.

## Entry points and variants

- A row in Late, Today and the later groups, and a row in Loose
- Clicking another row while the panel is open, which moves the panel to it
- × and Escape
- Quit and relaunch

## Preconditions

- A new instance name, connected with agent-browser
- Capture "Book the checkup" today, "Call about the claim" yesterday and "Desk chair?" with no date

## Checks

Read Now with the `eval` in [Now](now.md) (names only are enough here), and the panel with `document.querySelector('aside[aria-label]').innerText` and its `h2`.

1. Click `button "Open \"Book the checkup\""`: the panel's `h2` is `Entry · Nov 8` (the written day), the body is `Book the checkup`, and the day button reads `Today`.
2. Choose Thursday of this week in the day's popover: Now shows `["This week","1",["Book the checkup"]]`, and the last event is "follow-up date set" with that day, `time` `null` and `repeat` `null`. Type `930` in Time and press Enter, then choose Weekly by keyboard and press `button "Monday"`: the row shows `↻ every Mon, Thu` and `Thu, 9:30`, and the last event's `repeat` is `{"kind":"weekly","weekdays":[1,4]}`.
3. Complete: the panel shows `Completed Nov 8` and Undo, the day button names the next Monday, and the last event is "follow-up date completed" whose `next` is that Monday. Undo: the last event is "follow-up date set" with the completed date (`2026-11-12`, `09:30`, weekly `[1,4]`), and "Completed" is gone.
4. Put away: the row leaves Now, the `h2` is `Entry · Nov 8 · put away`, and the buttons are Bring back and Delete. The last event is "entry put away". Bring back: the row is back in This week.
5. `fill` the body with `Book the checkup with Dr. Lee`, then press Tab: the row's body changes, and one "entry edited" is stored. `fill` it with three spaces and press Tab: the body reads the last saved text, and nothing is stored. Edit it again and press Escape: the panel closes and exactly one more "entry edited" is stored.
6. Click "Desk chair?" in Loose: the panel shows only Bring back…, Put away and Delete. Click "Call about the claim": the panel moves to it. Open its day popover and press Escape: the popover closes and the panel stays.
7. Complete it in the panel: it moves to Loose, and the panel shows `Completed Nov 8, kept as a record` and Undo.
8. Capture "test", open it and press Delete: the dialog shows. Escape closes only the dialog. Press Delete, then the dialog's Delete: the panel closes, "test" leaves Loose, and the last event is "entry deleted" with its `entryId`. After `verify down` and `verify up`, "test" is still gone and `verify db "SELECT count(*) n FROM events WHERE type='entry deleted'"` prints `1`.
9. ✓ on a row with the panel closed completes it without opening the panel.
10. `verify doctor` is `ok` with `windowMessages` `[]`, and `grep -c "^Weft failed" <appLog>` prints `0`.

## Not covered

- Updates, in [Updates](updates.md). The contract suite covers how a deleted Entry's Updates are listed.
- A refusal or failure while saving, which the window cannot cause. The panel then shows `Weft refused this change: …` or `Weft couldn't save this change: …`.

## Traps

- In a covered window (`document.visibilityState` is `hidden`), a Select's exit animation can stall, leaving an invisible layer over the page that takes pointer clicks ("covered by <div inside div#…>"). Act by keyboard (`focus @ref`, then Enter) until it is gone, or run `up` again.
- `Meta+a` does not select a field's text over the debugging port. Use `fill`.
- Now's Loose column is also an `aside`, without a label. Read the panel as `aside[aria-label]`.
