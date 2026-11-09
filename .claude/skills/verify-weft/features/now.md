# Now

Now is the tab the app opens on. Today's date heads it ("Sunday, November 8"), with the capture box under it. Below the box, Entries with a Follow-up date are grouped by when they come back: Late, Today, Tomorrow, This week (two to six days ahead) and Later. Late and Today come first, as outlined rows. Tomorrow, This week and Later follow as plainer rows, each group named on the left. Each group shows its count and holds only when it has Entries. Within a group, Entries go by day, then time, a day with no time first, then by when they were written. Beside the groups, the Loose list holds the top-level Entries on no Thread with no Follow-up date, newest first, under "On no thread, and fine as they are." Put-away Entries show in neither. Clicking a row opens its Entry in [the entry panel](entry-panel.md). Rows show their Threads as chips, and Quiet threads sits under Loose ([Threads](threads.md)).

A row shows a ✓ that completes its Follow-up date ([Complete a follow-up date](complete-a-follow-up-date.md)), the Entry's body in full, then its rhythm when it has a Repeat ("↻ every Sunday") and its date. Today and Tomorrow rows show only the time, or no date at all, since their group already names the day. Late is a fact, not an alarm: only Late's heading and dates take the Late colour, and the window title stays "Weft", with no count or badge.

"Today" is the Mac's calendar day. Now works it out again at local midnight and when the window comes back.

## Entry points and variants

- Opening the app, and relaunching it (`verify down`, `verify up`)
- Capturing with a Follow-up date in each group's range, and with none ([Capture an entry](capture-an-entry.md) says how to fill the date and time)
- A new data folder, with nothing in it

## Preconditions

- A new instance name, connected with agent-browser
- Today's date, from `eval "new Date().toString()"`, to work out the days to type

## Checks

Read Now with this `eval`. It returns each section of the open view as `[name, count, items]`, the Loose list and Quiet threads last, and each item as `<body> | <datetime> <shown>`:

`JSON.stringify([...document.querySelectorAll('[role=tabpanel]:not([inert]) section')].map(s => [s.querySelector('h2').firstChild.textContent, s.querySelector('h2').lastChild.textContent, [...s.querySelectorAll('[role=listitem]')].map(i => i.querySelector('[data-slot=item-content] > span').textContent + ' | ' + i.querySelector('time').getAttribute('datetime') + ' ' + i.querySelector('time').textContent)]))`

1. On a new data folder, the open view's text (`innerText` of `[role=tabpanel]:not([inert])`) shows today's date ("Sunday, November 8"), the capture box's "Bring back…" and "Add", "Nothing is coming back.", then `Loose`, `0`, "On no thread, and fine as they are." and "Nothing loose.", then `Quiet threads`, `0`, "Open, with nothing asking." and "No quiet threads.".
2. Capture "Hiked, felt calm" with no date; "Call about the claim" for yesterday; "Dentist follow-up" in three weeks; "Pick up the prints" in four days; "Book the checkup" today at 09:30; "Renew the passport" tomorrow; "Water the plants" today with no time; "Desk chair?" with no date. The `eval` gives, with today 2026-11-08 as the example: `["Late","1",["Call about the claim | 2026-11-07 Yesterday"]]`, `["Today","2",["Water the plants | 2026-11-08 ","Book the checkup | 2026-11-08T09:30 9:30"]]`, `["Tomorrow","1",["Renew the passport | 2026-11-09 "]]`, `["This week","1",["Pick up the prints | 2026-11-12 Thu"]]`, `["Later","1",["Dentist follow-up | 2026-11-29 Nov 29"]]`, `["Loose","2",["Desk chair? | <instant> Nov 8","Hiked, felt calm | <instant> Nov 8"]]`, `["Quiet threads","0",[]]`.
3. Capture "Stretch" today at 07:00. Today's count is `3`, and "Stretch" sits between "Water the plants" and "Book the checkup".
4. `eval "document.title"` is `"Weft"`.
5. After `verify down` and `verify up`, the `eval` gives the same as before the relaunch, instants included.
6. `verify doctor` is `ok` with `windowMessages` `[]`, and `grep -c "^Weft failed" <appLog>` prints `0`.

## Not covered

- Crossing midnight with the window open, which needs the Mac's clock moved. `useToday` in `packages/app/src/now.tsx` handles it.
- Updates on Now are in [Updates](updates.md). Putting an Entry away is in [The entry panel](entry-panel.md); Thread chips and Quiet threads are in [Threads](threads.md).

## Traps

- The groups are read again after each change notification. Wait on the number of `[role=listitem]` before reading.
- A group heading's text is its name and count run together (`Today2`); read them as the `eval` does.
- The first child of a row is its ✓, not its body. Read the body from `[data-slot=item-content] > span`, as the `eval` does.
- At 760 points tall, This week and Later sit below the fold once Late and Today hold a few rows. Scroll the window before a screenshot of them.
