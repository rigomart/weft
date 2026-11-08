# Complete a follow-up date

Each card on [Now](now.md) has a ✓ button, named `Complete "<body>"`. Pressing it runs "complete follow-up date": the store writes one "follow-up date completed" event with the Follow-up date that was dealt with (`completed`), when (`completedAt`, an instant), and `next`, the Follow-up date the Entry has afterwards. Without a Repeat, `next` is `null`: the Entry's Follow-up date clears and the Entry stays. It leaves its group, whose count drops by one, and a group left empty goes. With no Thread and no Follow-up date left, a top-level Entry is Loose, so it shows at the Loose list, by when it was written.

## Entry points and variants

- Clicking ✓ on a card
- Focusing ✓ (`focus @<ref>`) and pressing Enter
- The last card in a group
- Quit and relaunch: `verify down` without `--purge`, then `verify up`

## Preconditions

- A new instance name, connected with agent-browser
- Capture "Desk chair?" with no date, "Call about the claim" for two days ago, "Water the plants" today, "Book the checkup" today at 09:30 and "Renew the passport" tomorrow, as [Capture an entry](capture-an-entry.md) says

## Checks

Read Now with the `eval` in [Now](now.md). Each button's ref is in `snapshot -i` as `button "Complete \"<body>\""`.

1. Before: `["Late","1",[…"Call about the claim"…]]`, `["Today","2",["Water the plants | … Today","Book the checkup | …T09:30 Today, 9:30"]]`, `["Tomorrow","1",…]`, `["Loose","1",["Desk chair? | …"]]`.
2. Click ✓ on "Book the checkup", then wait until Loose has two items. Today is `["Today","1",["Water the plants | … Today"]]`, and Loose lists "Book the checkup" with its written day. `alerts` (`document.querySelectorAll('[role=alert]').length`) is `0`, and `document.title` is `"Weft"`.
3. `verify db "SELECT type, content FROM events ORDER BY hlc"`: the last row is `follow-up date completed` with that `entryId`, `completedAt` an instant within the last minute, `completed` `{"day":"<today>","time":"09:30","repeat":null}` and `next` `null`. `verify db "SELECT follow_up_day, follow_up_time, put_away FROM entries WHERE body = 'Book the checkup'"` prints `null`, `null`, `0`.
4. After `verify down` and `verify up`, the `eval` gives the same as in check 2, and `verify db "SELECT count(*) AS n FROM events WHERE type = 'follow-up date completed'"` prints `1`.
5. Focus ✓ on "Call about the claim" and press Enter. The Late section is gone (`document.querySelector('#now-late')` is `null`), and Loose holds three items. Focus (`document.activeElement.getAttribute('aria-label')`) moves to the ✓ that took the card's place, or the last one when it was the last, and to `"What's on your mind?"` when no ✓ is left.
6. `verify doctor` is `ok` with `windowMessages` `[]`, and `grep -c "^Weft failed" <appLog>` prints `0`.

## Not covered

- A refusal or failure while completing, which the window cannot cause. The window then shows `Weft refused to complete "<body>": …` or `Weft couldn't complete "<body>": …` above the groups. The contract suite covers the refusals.
- A Follow-up date with a Repeat: [Repeat a follow-up date](repeat-a-follow-up-date.md).

## Traps

- A completed Entry moves to Loose, so the number of `[role=listitem]` stays the same. Wait on a group's count or a section's absence instead.
