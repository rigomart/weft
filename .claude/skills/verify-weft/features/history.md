# History

The History tab shows the lanes view, for reviewing, not arranging: nothing is dragged. Time runs left to right with the months marked, a dashed line and "today" at now, and the view opens scrolled so today sits about two thirds of the way across (`region "Timeline"`, when it is wider than the window). It is read from the same tables as Now, and every position comes from a date (ADR 0002).

Each open Thread is a lane, most recently active first, except that Threads sharing Entries are kept side by side. Its name on the left (`button "Open thread \"<name>\""`) says "<n> entries · <n> asking" and opens the Thread. Its line runs from its first dot to today, then dotted to its last dot after today. Resolved Threads follow the open ones, most recently resolved first, dimmed, with "resolved <day>" (`button "Open thread \"<name>\", resolved"`); a resolved lane's line ends when it was resolved. Below the lanes, the Loose band holds the Entries on no Thread, with "<n> on no thread". Nothing put away or resolved leaves History (ADR 0001).

Each Entry is a dot (`button "Open \"<body>\""`): filled where it was completed, else where it was written; open at its Follow-up date when it has one; in the Late colour (`border-late`) when that date is past. An Entry on several Threads is one pill spanning their lanes, with a dot on each. An Update is joined by an arc to the Entry it follows from. A put-away Entry, and an Update to one, is a faded dot (`opacity-30`) on its lanes or in the Loose band, named `Open "<body>", put away`; it counts toward its lane's entries but not its asking. A repeating Follow-up date is one open dot at its next occurrence, labelled "↻ <rhythm>". Dots closer than 14px in a lane move apart, away from today, so each can be clicked. A dot is labelled with its body, cut at 24 characters, where the label fits. Hovering a dot shows its body, then when ("Nov 8", "Comes back Nov 19", "Late · Nov 5"), its Threads or "Loose", and "follows from an earlier entry" for an Update, and "put away". Clicking it opens the entry panel and rings the dot (`aria-current`). The panel's Bring back, for a put-away Entry, and the thread panel's Reopen, for a resolved Thread, return it to Now and History's open lanes. Opening the side panel does not move the dots: the timeline narrows and scrolls instead, keeping the open Entry's dot in view.

## Entry points and variants

- The History tab, with and without a side panel open
- A dot on one lane, on several, in the Loose band; asking, late, repeating, an Update
- A lane's name, open and resolved
- A put-away Entry and a resolved Thread, opened from History and brought back or reopened there
- Quit and relaunch

## Preconditions

- A new instance name, connected with agent-browser
- Capture "Dentist: grinding teeth, night guard, asked if I'm stressed.", start Teeth, Sleep quality and Work stress from its Threads section, add the Update "Ordered the night guard" with no day, then to that one "Get the night guard fitted" for Nov 20 (12 days out) ([Updates](updates.md))
- Capture "Call about the claim" for yesterday, start "Insurance claim" from it, ✓ it and save "Rejected, appeal by the 20th" for Nov 19 (11 days out)
- Capture "Stretch before bed" for tomorrow, Weekly on Monday, and put it on Sleep quality
- Capture "Desk chair?", "Ana recommended a book about sleep", "Return the library book" for Nov 5 and "Renew passport" for Aug 3

## Checks

Read the view with the script below, saved to a file and passed as `agent-browser eval "$(cat <file>)"`. Each dot is `[body, x from the today line, height, kind of each of its dots]`.

```js
(() => {
  const t = document.querySelector('[role=region][aria-label=Timeline]');
  const today = t.querySelector('line[stroke-dasharray="2 3"]').getBoundingClientRect().x;
  const panel = document.querySelector('[role=tabpanel]:not([inert])');
  return JSON.stringify({
    lanes: [...panel.querySelectorAll('button[aria-label^="Open thread"]')].map(b => b.innerText),
    loose: [...panel.querySelectorAll('span')].find(s => s.textContent.endsWith('on no thread'))?.textContent,
    dots: [...t.querySelectorAll('button[data-entry]')].map(b => { const r = b.getBoundingClientRect(); return [b.getAttribute('aria-label').slice(6, -1), Math.round(r.x + r.width / 2 - today), Math.round(r.height), [...b.children].map(c => c.className.includes('border-late') ? 'late' : c.className.includes('bg-card') ? 'open' : 'filled').join(',')]; }),
    labels: [...t.querySelectorAll('span.pointer-events-none')].map(s => s.textContent),
    joins: t.querySelectorAll('path').length,
    scroll: [t.scrollLeft, t.scrollWidth, t.clientWidth, Math.round(today - t.getBoundingClientRect().x)],
  });
})()
```

1. Open History. `lanes` is `["Sleep quality\n4 entries · 2 asking","Work stress\n3 entries · 1 asking","Teeth\n3 entries · 1 asking","Insurance claim\n2 entries · 1 asking"]` and `loose` is `"4 on no thread"`.
2. The dentist note, "Ordered the night guard" and "Get the night guard fitted" are 174 high (three lanes) with three dots each, filled, filled and open. "Call about the claim" is filled at 0 and "Rejected, appeal by the 20th" open at a positive x. `joins` is 3. "Stretch before bed" is one open dot just after today. "Return the library book" and "Renew passport" are `late`, left of today.
3. `scroll` is `[153,1099,866,589]` in the 1100×760 window: today at 68% of the timeline's width. It stays there as Entries arrive until the timeline is scrolled.
4. Hover "Rejected, appeal by the 20th": `[data-slot=tooltip-content]` reads `Rejected, appeal by the 20th\nComes back Nov 19 · Insurance claim · follows from an earlier entry`.
5. Click "Call about the claim": the entry panel is `Entry · Nov 8` on its body, the dot is `aria-current`, and it is still inside `region "Timeline"`, which is now 466 wide. Click the dentist note's pill: its `x` in the timeline is the same as before the click. Close; click "Desk chair?", "Ana recommended a book about sleep", "Call about the claim" and "Stretch before bed" in turn, closing each: each opens its own Entry.
6. Click "Teeth" on the left: the panel is `Thread Teeth` and that name is `aria-current`.
7. Open "Sleep quality" from its lane and Resolve; open "Desk chair?" from its dot and Put away; close the panel. `lanes` is `["Insurance claim\n2 entries · 1 asking","Work stress\n3 entries · 1 asking","Teeth\n3 entries · 1 asking","Sleep quality\nresolved Nov 8"]`, `loose` is still `"4 on no thread"`, "Stretch before bed" is still a dot, and the Desk chair dot is named `Open "Desk chair?", put away` and has `opacity-30`. Hovering it reads `Desk chair?\nNov 8 · Loose · put away`.
8. Click that dot: the panel is `Entry · Nov 8 · put away` with Bring back. Press it: the log ends with "entry brought back", the dot is `Open "Desk chair?"` without `opacity-30`, and Now's Loose list has "Desk chair?" again.
9. Click `button "Open thread \"Sleep quality\", resolved"`: the thread panel shows "Resolved Nov 8" and Reopen. Press Reopen: `lanes` starts with `"Sleep quality\n4 entries · 2 asking"`, and the Sleep quality chips on Now no longer say ", resolved".
10. After `verify down` and `verify up`, the view reads the same.
11. `verify doctor` is `ok` with `windowMessages` `[]`, and `grep -c "^Weft failed" <appLog>` prints `0`.

## Not covered

- A separate archive screen, which History replaces.
- An Entry written on an earlier day, which no user action can make: every Entry captured during a check is written now, so the past is reached through late Follow-up dates.
- Search and filters, which History does not have.

## Traps

- Base UI may keep the History panel mounted, `inert`, after you switch tabs, so coming back keeps its scroll. Check the opening scroll after a relaunch.
- Wait for `document.getAnimations().length === 0` after selecting the tab before clicking a dot.
- A label is left out when the next label or dot leaves no room, so `labels` changes with the window's width and whether the panel is open.
