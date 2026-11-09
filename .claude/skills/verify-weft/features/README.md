# Features

What to prove about each user-visible feature. Prove a change by driving its new behavior and rerunning the checks of every feature it touched.

| Feature | Behavior | Not covered |
| --- | --- | --- |
| [Open the app](open-the-app.md) | A window with the Now, Workspace and History tabs, and a new database in the run's data folder. | Keyboard moves between tabs; the light theme's look; a failed launch's error dialog |
| [Capture an entry](capture-an-entry.md) | Enter or Add writes an Entry, with an optional Follow-up date, shown on Now, kept in the event log and still listed after a relaunch. | A failure in main, which the window cannot cause; capturing in the packaged window |
| [Now](now.md) | Entries with a Follow-up date grouped as Late, Today, Tomorrow, This week and Later, with counts, and the Loose list beside them. | Crossing midnight with the window open; put-away Entries, Updates and Threads, which the window cannot make yet |
| [Complete a follow-up date](complete-a-follow-up-date.md) | ✓ on a card on Now completes its Follow-up date: one "follow-up date completed" event, the card leaves its group and the Entry stays. | A refusal or failure while completing; Repeats |
| [Quit and relaunch](quit-and-relaunch.md) | The same database file and the same stored theme after a relaunch. | Quitting from the menu or by closing the window, which nothing over the debugging port can reach |
| [One Weft per data folder](one-weft-per-data-folder.md) | A second launch on the same folder shows the running window and exits; another folder opens alongside. | The window coming forward, and a minimized window being restored |
| [The packaged app](packaged-app.md) | `Weft.app` opens its own database and event log through libsql, keeps the Entries in it, refuses a debugging port, and reopens the same file. | Its window's screen and capturing in it, which no driver can reach in a packaged build (check 6 is by hand) |
