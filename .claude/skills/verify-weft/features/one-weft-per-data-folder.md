# One Weft per data folder

Starting Weft again on a data folder it already has open does not open the database a second time: the new launch shows the running window and exits. A run on another data folder opens alongside.

## Entry points and variants

- A second launch on the instance's data folder: `env -u ELECTRON_RUN_AS_NODE WEFT_USER_DATA="<dataDir>" bun run --cwd apps/desktop start`
- A run on another folder: `verify up` with a second instance name

## Preconditions

- An instance after `up`, connected with agent-browser, with Workspace selected (so you can tell its window from a new one)

## Checks

1. The second launch prints `Weft is already open on <dataDir>; showing its window.` and exits with `0` within a few seconds.
2. Afterwards, `verify doctor` is `ok` with the same `pid` as before, and `lsof -t <database>` prints only that `pid`.
3. The instance's window still has Workspace selected: it is the same window, not a new one.
4. A second instance runs alongside: its `up` gives another `dataDir` and `debugPort`, both `doctor`s are `ok`, and its `appLog` opens its own `database`.

## Traps

- No check from inside the window shows that it came forward (see the skill's Gotchas). Report that part as checked by hand on a visible desktop, or `INCONCLUSIVE`.
- Do not pass `WEFT_DEBUG_PORT` to the second launch.
