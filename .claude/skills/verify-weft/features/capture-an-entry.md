# Capture an entry

The Now tab has a capture box ("What's on your mind?") and an Add button. Under them, every Entry is listed newest first, with the day it was written. Each capture writes one "entry written" event to the log, and the list is read from the `entries` table built from it, so an Entry is still listed after a relaunch.

## Entry points and variants

- Typing in the box and pressing Enter
- Typing in the box and clicking Add
- Changing tabs with text in the box
- Quit and relaunch: `verify down` without `--purge`, then `verify up` on the same instance name

## Preconditions

- A new instance name, so the list starts empty, connected with agent-browser
- Click the box before typing (see Traps)

## Checks

Right after each action, read the box (the window's only `input`), focus, Add, the alerts and the list with this `eval`, which returns JSON:

`JSON.stringify({box: document.querySelector('input').value, focus: document.activeElement.getAttribute('aria-label'), add: document.querySelector('button[type=submit]').disabled, alerts: document.querySelectorAll('[role=alert]').length, items: [...document.querySelectorAll('[role=listitem]')].map(i => [i.firstChild.textContent, i.querySelector('time').getAttribute('datetime'), i.querySelector('time').textContent])})`

Each item is `[body, datetime, shown day]`. The `datetime` is a UTC ISO instant, such as `2026-11-08T22:02:36.481Z`. The shown day is that instant's day in the Mac's time zone, such as `Nov 8`.

1. Before typing, `add` is `true` and `items` is `[]`. After typing "Desk chair?", `add` is `false`. Clicking the Workspace tab, then the Now tab, keeps the text: `box` is `"Desk chair?"` and `add` is `false`. Click the box again before typing more.
2. Clicking Add gives `box` `""`, `focus` `"What's on your mind?"`, `add` `true`, `alerts` `0`, and one item: `["Desk chair?", <its datetime>, <today>]`.
3. Typing "Back stiff after the drive" and pressing Enter gives two items: "Back stiff after the drive", then "Desk chair?". The first item's `datetime` is the later one.
4. Typing three spaces and pressing Enter changes nothing: `add` is `true`, `alerts` is `0`, and `items` is the same as in check 3.
5. `verify db "SELECT type, version, json_extract(content, '$.body') AS body FROM events ORDER BY hlc"` prints `rows` `[{"type":"entry written","version":1,"body":"Desk chair?"},{"type":"entry written","version":1,"body":"Back stiff after the drive"}]`. `verify db "SELECT body, written_at FROM entries ORDER BY written_at DESC"` prints each item's body with its `written_at` equal to the item's `datetime`.
6. Record `file.inode` and `file.createdAt` from check 5. After `verify down` and `verify up`, `verify db` prints the same two values. Run `agent-browser connect <debugPort>` again (`down` closed the session), wait until two list items show, and `items` equals check 3's, `datetime`s included.
7. Capture "Physio on Tuesday". `verify db "SELECT device_id, count(*) AS events FROM events GROUP BY device_id"` prints one row with `events` `3`, and its `device_id` equals the `id` from `verify db "SELECT id FROM device"`.
8. `verify doctor` is `ok` with `windowMessages` `[]`, and `grep -c "^Weft failed" <appLog>` prints `0`.

## Not covered

- A failure in main, such as a full disk. Nothing a user can do in the window causes one; `apps/desktop/src/ipc/ipc.test.ts` shows how the window receives it. The window then shows `Weft couldn't save this entry: <message>` under the box and keeps the text, and main prints `Weft failed on run: <stack>` to `appLog`.
- Capturing in the packaged app's window, which no driver can reach. [The packaged app](packaged-app.md) proves it opens the event log and keeps an Entry.

## Traps

- The list is read again after each change notification. Wait on `document.querySelectorAll('[role=listitem]').length` before reading it.
- Click the box before typing. With focus on the page body, typed letters can repeat, and `d` switches the theme (see the skill's Gotchas).
