# Features

What to prove about each user-visible feature. Prove a change by driving its new behavior and rerunning the checks of every feature it touched.

| Feature | Behavior | Not covered |
| --- | --- | --- |
| [Open the app](open-the-app.md) | A window with the Now, Workspace and History tabs, and a new database in the run's data folder. | Keyboard moves between tabs; the light theme's look; a failed launch's error dialog |
| [Capture an entry](capture-an-entry.md) | Enter or Add writes an Entry, with an optional Follow-up date, shown on Now, kept in the event log and still listed after a relaunch. | A failure in main, which the window cannot cause; capturing in the packaged window |
| [Now](now.md) | Today's date over the capture box, then Entries with a Follow-up date grouped as Late and Today in full, Tomorrow, This week and Later after them, with counts, and the Loose list beside them. | Crossing midnight with the window open; Updates and Threads, which the window cannot make yet |
| [Complete a follow-up date](complete-a-follow-up-date.md) | ✓ on a row on Now completes its Follow-up date: one "follow-up date completed" event, the row leaves its group and the Entry stays. | A refusal or failure while completing |
| [Repeat a follow-up date](repeat-a-follow-up-date.md) | The capture box sets a Repeat (every N days, weekly on chosen weekdays, monthly on a day); the row shows ↻ and its rhythm; ✓ moves it to its next occurrence after today, missed ones collapsed. | Editing a Repeat, which is in [The entry panel](entry-panel.md) |
| [The entry panel](entry-panel.md) | Clicking a row on Now opens its Entry in a side panel: edit the body, set, change, complete or clear its Follow-up date and Repeat, undo a completion, put it away or bring it back, and delete it after confirming. × or Escape closes it. | An Entry's Updates (#14); a refusal while saving |
| [Quit and relaunch](quit-and-relaunch.md) | The same database file and the same stored theme after a relaunch. | Quitting from the menu or by closing the window, which nothing over the debugging port can reach |
| [One Weft per data folder](one-weft-per-data-folder.md) | A second launch on the same folder shows the running window and exits; another folder opens alongside. | The window coming forward, and a minimized window being restored |
| [The packaged app](packaged-app.md) | `Weft.app` opens its own database and event log through libsql, keeps the Entries in it, refuses a debugging port, and reopens the same file. | Its window's screen and capturing in it, which no driver can reach in a packaged build (check 6 is by hand) |
