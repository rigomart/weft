---
name: verify-weft
description: Prove a user-visible Weft change in the real Electron desktop app, on an isolated instance with its own data folder, by driving its window with agent-browser over the debugging port and checking exact values on screen, in the app's log and in its weft.db. Use before a PR, to reproduce a bug in the app, or to re-verify a feature.
---

# Verify Weft

Proof means driving the change in the real desktop app the way a person would, on an isolated instance, and checking exact values: what the window shows right after each action, what the desktop host printed to its log, and what is in the instance's `weft.db`. [`features/`](features/README.md) says what to prove about each feature but gives no click-by-click steps: work those out from the screen each time.

Three commands, all from the repo root (the examples also use `jq`):

- `bun run --silent verify up --instance <name>` builds `apps/desktop`, opens it on the instance's own data folder with a debugging port, waits until the window has painted, and prints one JSON object: `dataDir`, `database`, `debugPort`, `session`, `evidenceDir`, `appLog`, `pid`. `bun run verify --help` lists the rest (`doctor`, `env`, `db`, `down`). On `{"ok":false}`, follow its `hint`. Keep `--silent` when you pipe to `jq`; without it, `bun run` prints its own `$ bun …` line first.
- `agent-browser --session <session> <command>` drives the window, after `agent-browser --session <session> connect <debugPort>`. Take both values from `up` or `env`. Its usage guide is `agent-browser skills get core`, and the Electron notes are `agent-browser skills get electron`. If `agent-browser --version` fails, stop and ask the user to install it.
- `bun run --silent verify db "<SELECT or PRAGMA>" --instance <name>` reads the instance's `weft.db`, read-only, whether or not its Weft is running. It also prints the file's `inode` and `createdAt`, which show whether a relaunch opened the same file.

## Isolation

Pick an instance name for your task (lowercase letters, digits and dashes, such as `tabs-fix`) and pass `--instance <name>` to every `verify` command. Pass `--session <session>` to every agent-browser command, or `export AGENT_BROWSER_SESSION=<session>` at the start of each shell call, since exports do not carry over between calls. Take `session` from `up` or `env`; do not build it from the instance name, because the session name also identifies this checkout. An instance owns its data folder (`.verify/instances/<name>/data`), its debugging port (from 9340), its logs (`.verify/instances/<name>/logs/`), its evidence folder (`.verify/evidence/<name>/<run>/`) and its agent-browser session. Another agent in this checkout must use a different name, and then both can verify at once.

Drive only an instance you started with `verify up`. Never drive or open the owner's Weft or its data folder (`~/Library/Application Support/Weft`), and never run the packaged app without `WEFT_USER_DATA`, since that opens the owner's data. Never connect to a debugging port that `up` or `env` did not print.

`up` builds from the working tree. It reuses a running instance only if no file has changed since and its window and debugging port still answer. Otherwise it quits that instance, rebuilds and relaunches it on the same data folder, and prints `"restarted"` with the reason. Run `up` again after every code change, before you check anything. Switching branches is different: `up` refuses an instance whose data was made on another branch, running or not, and prints the `down --purge` and `up` to run. It also refuses an instance folder that is a link to anywhere else.

## Users and test data

Weft has no sign-in, so there are no users to create. A new instance starts from an empty data folder: the window shows the Now, Workspace and History tabs with Now selected and an empty capture box with no Entries under it, and `weft.db` holds the event log's tables with no events in them. Assume no other state. Create anything a check needs in the window, with actions a user can take. `down` without `--purge` keeps the data folder, and `down --purge` empties it.

## Prove a change

1. `bun run --silent verify up --instance <name>`, then `bun run --silent verify doctor --instance <name>`. Every check should be `true` and `windowMessages` empty.
2. `agent-browser --session <session> connect <debugPort>`, then `get url`, which should print `app://weft/`.
3. Read the feature files the change touches in `features/`.
4. Drive the new behavior from every entry point the change touched (the feature files list them), and check right after each action.
5. Rerun the checks of each feature file the change touches.
6. If the change is visible, take the PR images (see Proof standards).
7. If the behavior changed on purpose, update those feature files in the same change. A new feature gets a file and a row in `features/README.md`.
8. Report (see Proof standards), then tear down with `bun run --silent verify down --purge --instance <name>`.

## Re-verify a feature

Run steps 1 and 2 of Prove a change on a new instance name, so the data folder starts empty. Then drive every numbered check in the feature's file, on each entry point it lists, and report each check by number with the values you saw: pass, fail, or `INCONCLUSIVE` with the step that could not run. Name any listed entry point that no check reached. Tear down as in step 8. When asked for PR images of behavior that did not change, take them the same way and label each as existing behavior.

## Driving

- One action, then look. After each action, take a fresh `snapshot -i` and use refs only from it. Fix and retry a step that fails; do not rerun a long chain from the top.
- Locate by role and name. The app has no `data-testid`. The tabs are `tab "Now"`, `tab "Workspace"` and `tab "History"`, and the open view is the `tabpanel` without `inert`, labelled by its tab: `find role tab click --name "History"`, or the ref from the snapshot.
- Wait on conditions: `wait "<css>"`, `wait --fn "<expression>"`, `wait --text "<visible text>"`. A wait is not a check: `wait <ms>` proves nothing, and `wait --text` only matches a case-sensitive substring. Confirm the value with `get text` or `eval`.
- Check exact values with `get text`, `is visible`, and `eval` that returns JSON, compared in full. Read focus right after the action: `eval "document.activeElement.textContent"`.
- To quit and relaunch, run `verify down` without `--purge`, then `verify up`. `down` sends Weft SIGTERM, which Electron handles as a quit: it exits cleanly and releases the data folder's lock. Nothing over the debugging port can quit or close the window (see Gotchas).
- To launch a second time on the same data folder, as a user does who opens Weft while it runs, run `env -u ELECTRON_RUN_AS_NODE WEFT_USER_DATA="<dataDir>" bun run --cwd apps/desktop start`. It uses the build from `up`. Do not pass `WEFT_DEBUG_PORT` to it.
- The app's log (`appLog`) gets one `--- up <build> <time>` line per launch, followed by what that run printed: `Weft opened <database> (SQLite <version>)`, `Weft showed app://weft/`, and any `Weft's window <level>: …`. Compare whole lines.
- Save evidence with `screenshot <evidenceDir>/<feature>-<step>.png` right after the action. Use `evidenceDir` from `up` or `env`. It stays the same across `down` and `up` until `down --purge`, so the shots from before and after a relaunch land in one folder. Its name is the UTC time the data folder was created.

Worked example, run as written (selecting History shows its view, and the database is the instance's own):

```bash
bun run --silent verify up --instance gen
export AGENT_BROWSER_SESSION="$(bun run --silent verify env --instance gen | jq -r .session)"
PORT=$(bun run --silent verify env --instance gen | jq -r .debugPort)
EVIDENCE=$(bun run --silent verify env --instance gen | jq -r .evidenceDir)
agent-browser connect "$PORT"                   # prints "[agent-browser] launched browser": its daemon, not a browser
agent-browser get url                           # app://weft/
agent-browser snapshot -i                       # tab "Now" [selected, ref=e3] … tabpanel "Now"
agent-browser find role tab click --name "History"
agent-browser eval "JSON.stringify({selected: document.querySelector('[role=tab][aria-selected=true]').textContent, panels: [...document.querySelectorAll('[role=tabpanel]:not([inert])')].map(p => document.getElementById(p.getAttribute('aria-labelledby')).textContent)})"
#   {"selected":"History","panels":["History"]}
agent-browser wait --fn "document.getAnimations().length === 0"
agent-browser screenshot "$EVIDENCE/open-the-app-history.png"
bun run --silent verify db "SELECT count(*) AS events FROM events" --instance gen
#   {"ok":true,"database":"…/.verify/instances/gen/data/weft.db","file":{"inode":…,"createdAt":"…","bytes":…},"rows":[{"events":0}]}
bun run --silent verify down --purge --instance gen
```

## Proof standards

- Drive the real user path. Never click or set values through `eval`, never call into the app's internals from `eval`, never write to `weft.db` or the data folder, and never write to `localStorage` to fake a state. Use `eval` only to read. Setting up a precondition through the window is fine. Producing the behavior under test by any other means is not.
- Check right after each action, not only at the end. Focus, a selected tab or a cleared box can be lost and then restored before the final screen.
- Query `weft.db` only for what the window cannot show: whether the same file survived a relaunch (`file.inode` and `file.createdAt`), an exact stored value, no duplicates, a real deletion. Compare whole rows, never a substring. Do not use SQL to re-check a value the window already shows after a relaunch.
- Drive every path the change touched. Name any path you changed but did not drive.
- The report says what you drove, because the diff does not show it: each check by number or by what it proved, the entry points, the exact values you saw, and the screenshot paths.
- A change a user can see gets an image of each changed state, cropped to the change (`screenshot "<css>" <path>`, such as `"[role=tablist]"`) and named `<feature>-<state>.png`. Take it only after `wait --fn "document.getAnimations().length === 0"`. When the change alters an existing screen, add a before image of the same state. Take it with the change's files reverted in the working tree, then run `up` (it rebuilds), take the shot, restore the files, run `up` again, and confirm with `git status` that the tree is back as it was. The report lists these images apart from the rest of the evidence, each with one line saying what it proves.
- An entry point you could not reach is reported with the step you tried and the precondition that was missing, never as verified through another path.
- A check that could not run is `INCONCLUSIVE`, never a pass. If the same step fails twice, stop that item, report it `INCONCLUSIVE` with the step and its output, and move on.
- Before calling something an app bug or writing a rule about the app, reproduce it a second way: another input method, the log, or `weft.db`. When a tool misbehaves, report a tool bug, not an app bug.

## Doctor and cleanup

```bash
bun run --silent verify doctor --instance <name>        # read-only; run it first whenever anything looks off
bun run --silent verify down --purge --instance <name>  # quit Weft, close the session, delete the data folder
```

`doctor` checks that the process is alive, the window has painted, the run opened the instance's own `weft.db`, the file exists, the debugging port answers and is bound by this instance (or, for `--packaged`, that it is refused), and the branch has not changed. `builtFromCurrentTree: false` means files changed since `up`: run `up` to rebuild. `windowMessages` lists the window's warnings and errors from this run.

`down` quits only the Weft that this instance started (it tracks the pid and its start time), and closes the instance's agent-browser session if one is open. Evidence under `.verify/evidence/<name>/` and logs under `.verify/instances/<name>/logs/` (`app.log`, `build.log`) survive `down` and `--purge`. Run `down --purge` after a failed attempt too, so nothing is left holding a port or a data folder. `up` and `down` wait for each other across the whole machine (they hold port 9339 while they work), so a slow `up` or `down` elsewhere on this machine can delay yours by a few seconds. A folder under `.verify/instances/` with no `state.json` is a stopped instance whose logs were kept; it holds nothing, and `rm -rf .verify` clears all of them once no instance is up.

## The packaged app

`bun run --cwd apps/desktop package`, then `bun run --silent verify up --packaged --instance <name>`, opens the packaged `Weft.app` on the instance's data folder. `up --packaged` asks for a debugging port with `WEFT_DEBUG_PORT` as usual, and the packaged build refuses it. As a result `debugPort` is `null`, `requestedDebugPort` names the port it refused, and agent-browser cannot drive the window. Prove a packaged run from the log, `db`, and `lsof -nP -a -p <pid> -iTCP -sTCP:LISTEN`, which prints nothing. `up --packaged` never packages: package again after a code change, before `up`. To switch an instance between the builds, `down` first (this keeps its data).

## Gotchas

App traps:

- **Tab switches animate** (`transition-all`). A screenshot taken right after a click shows the old tab still highlighted, even though `aria-selected` has already moved. Run `wait --fn "document.getAnimations().length === 0"` before any screenshot.
- **The old view lingers after a tab click.** Base UI keeps the outgoing `tabpanel` mounted, with `inert` and `data-ending-style`, until its exit ends, so `[role=tabpanel]` can match two. Read the open view as `[role=tabpanel]:not([inert])`.
- **The theme follows macOS** (`dark` or `light` on `<html>`) until the `d` key, pressed outside a text field, switches it. The choice is stored in the data folder's `localStorage` and survives a relaunch. A stray `d` with focus on the window changes it. `eval "matchMedia('(prefers-color-scheme: dark)').matches"` says what macOS is set to: a class that differs from it is a stored choice.
- **The window is 1100×760** (`innerHeight` 728) and has no responsive layout yet. Do not `set viewport`: it only emulates a size inside the same window, and the emulation stays on until relaunch.
- **A `reload` or relaunch resets the view to Now.** The app does not store the selected tab.
- **The window does not hot-reload.** `up` builds once. Run `up` after editing, and check for `"restarted"` or `"reused"`.
- **A fresh checkout may lack the Electron binary.** `up` downloads it (log: `logs/electron-install.log`).

agent-browser and Electron traps:

- **Never `open` a URL.** Over the debugging port it navigates the Weft window away from `app://weft/`, past the app's own navigation block, and Electron's security warnings fill `windowMessages`. If `get url` is not `app://weft/`, run `down` and `up`.
- **`close` only disconnects.** The window stays open. Use `verify down` to quit.
- **Nothing over the debugging port reaches the window frame or the menu.** Electron has no `Browser.getWindowForTarget` or `Browser.setWindowBounds`, so you cannot minimize, move, focus or close the window. `press Meta+q` does not quit, because the menu never sees it. Quitting is `verify down`.
- **Whether the window came forward cannot be proven from inside it.** `document.hasFocus()` reads `true` after agent-browser acts on the window, whatever macOS shows. Report a "comes forward" check as checked by hand on a visible desktop, or `INCONCLUSIVE`.
- **`connect` prints `[agent-browser] launched browser`.** That is agent-browser's daemon starting; no browser opens. `get url` confirms you are on `app://weft/`.
- **`press <letter>` or `keyboard type` with focus on the page body can repeat keys without stopping.** `reload` stops the repeat. Check `document.activeElement` before pressing a letter; after a tab click, focus is on that tab.
- **`wait --text` reads visible text only**, not labels or `aria-label`s. Wait on a selector for those.
