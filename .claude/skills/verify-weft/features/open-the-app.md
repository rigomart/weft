# Open the app

Starting Weft opens a window with the three views as tabs in its header, Now selected with the capture box ([capture an entry](capture-an-entry.md)) and the other views empty for now, and creates the database, with the event log's tables, in the data folder the run was pointed at.

## Entry points and variants

- `verify up` on a new instance (the unpackaged build). The packaged build is in [the packaged app](packaged-app.md).
- Tabs: click, or the ref from `snapshot -i`

## Preconditions

- A new instance name, so the data folder starts empty

## Checks

1. `snapshot -i` lists exactly `tab "Now" [selected]`, `tab "Workspace"`, `tab "History"` and `tabpanel "Now"`, and `get url` is `app://weft/`.
2. Clicking each tab selects it and shows only its view, right after the click: `{"selected":"<tab>","panels":["<tab>"]}` from
   `JSON.stringify({selected: document.querySelector('[role=tab][aria-selected=true]').textContent, panels: [...document.querySelectorAll('[role=tabpanel]:not([inert])')].map(p => document.getElementById(p.getAttribute('aria-labelledby')).textContent)})`
3. Workspace and History are empty: `document.querySelector('[role=tabpanel]:not([inert])').childElementCount` is `0` with each selected. Now has the capture box and no Entries: `snapshot -i` lists `textbox "What's on your mind?"` and `button "Add" [disabled]`, and `document.querySelectorAll('[role=listitem]').length` is `0`.
4. This run's lines in `appLog` include `Weft opened <database> (SQLite <version>)` with the instance's own `database` path from `env`, then `Weft showed app://weft/`.
5. `verify db "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name"` prints the instance's `database` and `rows` `[{"name":"built_tables"},{"name":"device"},{"name":"entries"},{"name":"entry_threads"},{"name":"events"},{"name":"threads"}]`, and `verify db "SELECT count(*) AS events FROM events"` prints `rows` `[{"events":0}]`: a new log with nothing in it.
6. `verify doctor` is `ok` with `windowMessages` `[]`.
7. `press d` with focus on the page body (`document.activeElement.tagName` is `BODY` right after `connect`) switches `<html>`'s class and opens no macOS window. This lists the on-screen windows of macOS's Dictation and Emoji & Symbols prompts, across all apps:
   `osascript -l JavaScript -e 'ObjC.import("CoreGraphics"); JSON.stringify(ObjC.deepUnwrap(ObjC.castRefToObject($.CGWindowListCopyWindowInfo($.kCGWindowListOptionOnScreenOnly, 0))).map(w => w.kCGWindowOwnerName).filter(n => n === "Dictation" || n === "Emoji & Symbols"))'`
   It prints `[]` before the press and again after `wait 2500`. If it is not `[]` before the press, another app has one open: the check is `INCONCLUSIVE`. It printed `["Dictation"]` when `d` brought up "Do you want to enable Dictation?" (see the skill's Gotchas).

## Traps

- Tab switches animate. Wait for `document.getAnimations().length === 0` before a screenshot, or the old tab still looks selected.
- Right after a click the old panel is still mounted, with `inert` and `data-ending-style`, until its exit ends. Read the open view as the panel without `inert`; `[role=tabpanel]` alone can match two.
