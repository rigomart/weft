# Pull out selection

Under the body in [the entry panel](entry-panel.md), `button "Pull out selection"` is off until part of the body is selected, beside "Select part of the text to make it an update of its own." Pressing it writes one "entry written" whose body is the selected text, trimmed, and whose `parentEntryId` is the open Entry, then opens the new Update in the panel, ready for a Follow-up date. The original body keeps the text: it is what was written then. It is one of the three ways an Update is made ([Updates](updates.md)).

## Entry points and variants

- Selecting with the keyboard (End, then Shift+ArrowLeft) and with the mouse
- An Entry, and an Update (pulling out of an Update adds an Update to it)

## Preconditions

- A new instance name, connected with agent-browser
- Capture "Cardiology: new medication, recheck in three months" with no date

## Checks

1. Open it: Pull out selection is disabled.
2. Click the body, press End, then Shift+ArrowLeft 23 times: the selection is `recheck in three months`, and Pull out selection is enabled.
3. Press it: the panel is `Update · <today>`, "Follows from Cardiology: new medication, recheck in three months", its body `recheck in three months`, and `Story · 2`. The last event is "entry written" with that body and the visit note's `entryId` as `parentEntryId`. `verify db "SELECT body FROM entries WHERE parent_entry_id IS NULL"` still prints the full visit note.
4. In the Update's own "Bring back…" (the panel's first), page three months on and pick that day: Now shows `["Later",["recheck in three months\n↳ Cardiology: new medication, recheck in three months\nLoose\n<that date>"]]`, and the visit note stays in Loose.
5. `verify doctor` is `ok` with `windowMessages` `[]`, and `grep -c "^Weft failed" <appLog>` prints `0`.

## Not covered

- Splitting an Entry into two unrelated Entries, which Weft does not do.

## Traps

- `eval` must not set the selection (proof standards). Select with the keyboard.
