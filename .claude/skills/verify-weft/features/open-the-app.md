# Open the app

Starting Weft opens a window with the three views as tabs in its header, Now selected and each view empty for now, and creates the database in the data folder the run was pointed at.

## Entry points and variants

- `verify up` on a new instance (the unpackaged build). The packaged build is in [the packaged app](packaged-app.md).
- Tabs: click, or the ref from `snapshot -i`

## Preconditions

- A new instance name, so the data folder starts empty

## Checks

1. `snapshot -i` lists exactly `tab "Now" [selected]`, `tab "Workspace"`, `tab "History"` and `tabpanel "Now"`, and `get url` is `app://weft/`.
2. Clicking each tab selects it and shows only its view, right after the click: `{"selected":"<tab>","panels":["<tab>"]}` from
   `JSON.stringify({selected: document.querySelector('[role=tab][aria-selected=true]').textContent, panels: [...document.querySelectorAll('[role=tabpanel]:not([inert])')].map(p => document.getElementById(p.getAttribute('aria-labelledby')).textContent)})`
3. Every view is empty: `document.querySelector('[role=tabpanel]:not([inert])').childElementCount` is `0`.
4. This run's lines in `appLog` include `Weft opened <database> (SQLite <version>)` with the instance's own `database` path from `env`, then `Weft showed app://weft/`.
5. `verify db "PRAGMA schema_version"` prints the instance's `database`, `file.bytes` `0` and `rows` `[{"schema_version":0}]`: a new, empty file.
6. `verify doctor` is `ok` with `windowMessages` `[]`.

## Traps

- Tab switches animate. Wait for `document.getAnimations().length === 0` before a screenshot, or the old tab still looks selected.
- Right after a click the old panel is still mounted, with `inert` and `data-ending-style`, until its exit ends. Read the open view as the panel without `inert`; `[role=tabpanel]` alone can match two.
