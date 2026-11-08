# Capture an entry

The Now tab has a capture box ("What's on your mind?") and an Add button, and under them an optional Follow-up date: "Bring back on" a day, "at" a time, and a Repeat ("Once" by default). The time field and the Repeat are off until a day is chosen. [Repeat a follow-up date](repeat-a-follow-up-date.md) covers the Repeat. Each capture writes one "entry written" event to the log, followed by one "follow-up date set" event when a day was chosen. Now is read from the `entries` table built from them, so an Entry and its date are still there after a relaunch. An Entry with a Follow-up date shows in [Now's](now.md) groups with its date ("Tomorrow, 9:30"); one without shows in its Loose list, newest first, with the day it was written.

## Entry points and variants

- Typing in the box and pressing Enter
- Typing in the box and clicking Add
- Changing tabs with text in the box
- Choosing a day, with or without a time, before Add or Enter (Enter in the date field submits too)
- Quit and relaunch: `verify down` without `--purge`, then `verify up` on the same instance name

## Preconditions

- A new instance name, so the list starts empty, connected with agent-browser
- Click the box before typing (see Traps)
- The date and time fields follow the Mac's region: on a day-first region the date's segments are day, month, year. Click the date field's first segment (from `snapshot -i`, `spinbutton "Day"` or `"Month"`) and type its digits one `press` at a time; the field moves to the next segment by itself. The time field's last segment is AM/PM on a 12-hour region (`press A`).

## Checks

Right after each action, read the box (the window's only `input`), focus, Add, the alerts and the list with this `eval`, which returns JSON:

`JSON.stringify({box: document.querySelector('input').value, day: document.querySelector('#capture-day').value, time: document.querySelector('#capture-time').value, timeOff: document.querySelector('#capture-time').disabled, focus: document.activeElement.getAttribute('aria-label'), add: document.querySelector('button[type=submit]').disabled, alerts: document.querySelectorAll('[role=alert]').length, items: [...document.querySelectorAll('[role=listitem]')].map(i => [i.firstChild.textContent, ...[...i.querySelectorAll('time')].map(t => t.getAttribute('datetime') + ' ' + t.textContent)])})`

`items` lists Now's groups first, then the Loose list. Each item is `[body, <Follow-up date>]` in a group, or `[body, <written>]` in Loose. A Follow-up date reads `<day> <label>` or `<day>T<time> <label>`, such as `2026-11-09T09:30 Tomorrow, 9:30`: the label says the day from today in the Mac's time zone (Today, Tomorrow, Yesterday, a weekday in the coming week, else the date) and the time without a leading zero. Written reads `<instant> <shown day>`, such as `2026-11-08T22:02:36.481Z Nov 8`, the shown day being that instant's day in the Mac's time zone.

1. Before typing, `add` is `true` and `items` is `[]`. After typing "Desk chair?", `add` is `false`. Clicking the Workspace tab, then the Now tab, keeps the text: `box` is `"Desk chair?"` and `add` is `false`. Click the box again before typing more.
2. Clicking Add gives `box` `""`, `focus` `"What's on your mind?"`, `add` `true`, `alerts` `0`, and one item: `["Desk chair?", "<its instant> <today>"]`, such as `["Desk chair?", "2026-11-08T22:02:36.481Z Nov 8"]`.
3. Typing "Back stiff after the drive" and pressing Enter gives two items: "Back stiff after the drive", then "Desk chair?". The first item's instant is the later one.
4. Typing three spaces and pressing Enter changes nothing: `add` is `true`, `alerts` is `0`, and `items` is the same as in check 3.
5. `verify db "SELECT type, version, json_extract(content, '$.body') AS body FROM events ORDER BY hlc"` prints `rows` `[{"type":"entry written","version":1,"body":"Desk chair?"},{"type":"entry written","version":1,"body":"Back stiff after the drive"}]`. `verify db "SELECT body, written_at FROM entries ORDER BY written_at DESC"` prints each item's body with its `written_at` equal to the item's instant.
6. Record `file.inode` and `file.createdAt` from check 5. After `verify down` and `verify up`, `verify db` prints the same two values. Run `agent-browser connect <debugPort>` again (`down` closed the session), wait until two list items show, and `items` equals check 3's, instants included.
7. Type "Book the checkup", choose tomorrow and 09:30 (`day` and `time` read them back, and `timeOff` turns `false` once the day is set), and click Add. `box`, `day` and `time` are `""`, `timeOff` is `true`, and the items include `["Book the checkup", "<tomorrow>T09:30 Tomorrow, 9:30"]`, before the Loose ones. Type "Call about the claim", choose the day before yesterday with no time, change tabs and back (`box` and `day` are kept), then press Enter in the date field: the first item is `["Call about the claim", "<that day> <its date>"]`, such as `2026-11-06 Nov 6`. `verify db "SELECT type, content FROM events ORDER BY hlc"` ends with each capture's "entry written" followed by a "follow-up date set" with the same `entryId` and `followUpDate` `{"day":…,"time":"09:30" or null,"repeat":null}`. After `verify down` and `verify up`, the items are unchanged.
8. Capture "Physio on Tuesday". `verify db "SELECT device_id, count(*) AS events FROM events GROUP BY device_id"` prints one row with `events` equal to the number of rows in `events` (`3` plus two per capture with a date), and its `device_id` equals the `id` from `verify db "SELECT id FROM device"`.
9. `verify doctor` is `ok` with `windowMessages` `[]`, and `grep -c "^Weft failed" <appLog>` prints `0`.

## Not covered

- A failure in main, such as a full disk. Nothing a user can do in the window causes one; `apps/desktop/src/ipc/ipc.test.ts` shows how the window receives it. The window then shows `Weft couldn't save this entry: <message>` under the box and keeps the text, and main prints `Weft failed on run: <stack>` to `appLog`.
- Capturing in the packaged app's window, which no driver can reach. [The packaged app](packaged-app.md) proves it opens the event log and keeps an Entry.

## Traps

- The list is read again after each change notification. Wait on `document.querySelectorAll('[role=listitem]').length` before reading it.
- Click the box before typing. With focus on the page body, typed letters can repeat, and `d` switches the theme (see the skill's Gotchas).
