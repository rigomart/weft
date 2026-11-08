# Features

What to prove about each user-visible feature. Prove a change by driving its new behavior and rerunning the checks of every feature it touched.

| Feature | Behavior | Not covered |
| --- | --- | --- |
| [Open the app](open-the-app.md) | A window with the Now, Workspace and History tabs, and a new database in the run's data folder. | Keyboard moves between tabs; the light theme's look; a failed launch's error dialog |
| [Capture an entry](capture-an-entry.md) | Enter or Add writes an Entry, listed newest first with its day, kept in the event log and still listed after a relaunch. | A failure in main, which the window cannot cause; capturing in the packaged window |
| [Quit and relaunch](quit-and-relaunch.md) | The same database file and the same stored theme after a relaunch. | Quitting from the menu or by closing the window, which nothing over the debugging port can reach |
| [One Weft per data folder](one-weft-per-data-folder.md) | A second launch on the same folder shows the running window and exits; another folder opens alongside. | The window coming forward, and a minimized window being restored |
| [The packaged app](packaged-app.md) | `Weft.app` opens its own database and event log through libsql, keeps the Entries in it, refuses a debugging port, and reopens the same file. | Its window's screen and capturing in it, which no driver can reach in a packaged build (check 6 is by hand) |
