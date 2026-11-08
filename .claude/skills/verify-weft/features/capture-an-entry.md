# Capture an entry

The Now tab has a capture box ("What's on your mind?") and an Add button, with every Entry listed under them, newest first, each with the day it was written. Capturing writes one "entry written" event, the list is read from the tables built from the log, and the Entry is still there after a relaunch.

## Entry points and variants

- Typing in the box and pressing Enter
- Typing in the box and clicking Add
- Quit and relaunch: `verify down` without `--purge`, then `verify up`

## Preconditions

- A new instance name, so the list starts empty, connected with agent-browser

## Checks

Read the box, focus, Add and the list right after each action with:
`JSON.stringify({box: document.querySelector('input').value, focus: document.activeElement.getAttribute('aria-label'), add: document.querySelector('button[type=submit]').disabled, items: [...document.querySelectorAll('[role=listitem]')].map(i => [i.firstChild.textContent, i.querySelector('time').getAttribute('datetime'), i.querySelector('time').textContent])})`

1. Before typing, `add` is `true` and `items` is `[]`. After typing "Desk chair?", `add` is `false`.
2. Clicking Add: `box` is `""`, `focus` is `"What's on your mind?"`, `add` is `true`, and `items` is `[["Desk chair?", <instant>, <today, such as "Nov 8">]]`.
3. Typing "Back stiff after the drive" and pressing Enter puts it first: `items` lists "Back stiff after the drive", then "Desk chair?", with the later `datetime` first.
4. Typing only spaces and pressing Enter changes nothing: `add` is `true`, the same `items`, and no `[role=alert]`.
5. `verify db "SELECT type, version, json_extract(content, '$.body') AS body FROM events ORDER BY hlc"` prints exactly the two events, `entry written`, version `1`, with those bodies, and `SELECT entry_id, body, written_at FROM entries ORDER BY written_at DESC` gives the same bodies and instants the window shows.
6. After `verify down` and `verify up`, `verify db` prints the same `file.inode` and `file.createdAt`, and after reconnecting the list is the same as in check 3.
7. Capturing again after the relaunch: `SELECT device_id, count(*) AS events FROM events GROUP BY device_id` gives one row, with the ID in `SELECT id FROM device`. The data folder keeps its device ID across launches.
8. `verify doctor` is `ok` with `windowMessages` `[]`, and `appLog` has no `Weft failed` line.

## Not covered

- A failure in main, such as a full disk. Nothing a user can do in the window causes one; `apps/desktop/src/ipc/ipc.test.ts` shows how the window receives it. The window then shows `Weft couldn't save this entry: <message>` under the box, keeps the text, and main prints `Weft failed on run: <stack>` to `appLog`.
- Capturing in the packaged app's window, which no driver can reach. [The packaged app](packaged-app.md) proves it opens the event log.

## Traps

- The list is read again after each change notification, so wait on `document.querySelectorAll('[role=listitem]').length` before reading it.
- Clicking the box first: with focus on the page body, typed letters can repeat, and `d` switches the theme (see the skill's Gotchas).
