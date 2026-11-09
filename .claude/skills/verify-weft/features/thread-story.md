# A Thread's story

Under the header of [a Thread's panel](threads.md), "Story · <count>" lists every Entry and Update on the Thread, put away or not, with "↳ marks what happened next." (or "Nothing is on this thread yet."). It is read from the same tables as Now: there is no second record (ADR 0002).

The list splits at a "Today" divider (`separator`). Above it is what happened, oldest first: each line at the day it was completed, else the day it was written, or at its Follow-up date when that date is late. Below it is what is coming: each Entry with a Follow-up date from today on, by date and time. Each line shows its date on the left: the Follow-up date as a row on Now names it ("Yesterday", "Nov 20"), else the day. Updates are marked ↳. An Entry with a Follow-up date is marked ○; a late one has its date and ○ in the Late colour and ", late" for screen readers. A completed one is marked ✓, and a put-away one is dimmed with " · put away". A first Entry that is also on other Threads says "also on" with their chips, which open those Threads. Clicking a line (`button "Open \"<body>\""`) opens that Entry.

## Entry points and variants

- A Thread opened from a chip on Now, from the entry panel, from Quiet threads, and from an "also on" chip
- An Entry with Updates, one dated and one not; a late Entry; an Entry on several Threads
- Quit and relaunch

## Preconditions

- A new instance name, connected with agent-browser
- Capture "Dentist: grinding teeth, night guard, asked if I'm stressed.", put it on new Threads Teeth, Sleep and Work stress, add the Update "Ordered the night guard" with no day, then from the dentist note the Update "Get the night guard fitted" with a day in two weeks ([Updates](updates.md))

## Checks

Read the story with `JSON.stringify([...document.querySelectorAll('aside[aria-label] ol > li')].map(l => l.innerText))`.

1. Open "Teeth" from a chip on Now: the panel is `Thread Teeth` and the story reads `["Nov 8\nDentist: grinding teeth, night guard, asked if I'm stressed.\nalso on\nSleep\nWork stress","Nov 8\n↳Ordered the night guard","TODAY","Nov 20\n↳○ Get the night guard fitted"]` (with today's and that day's dates).
2. Click "Ordered the night guard": the entry panel opens on that Update.
3. Capture "Call the lab about the mould" for yesterday and put it on Teeth. Teeth's story starts with `Yesterday\n○ Call the lab about the mould\n, late`, before the dentist note, and its date has the Late colour (`text-late`).
4. Click "Sleep" in "also on": the panel is `Thread Sleep`, and the dentist note there says "also on Teeth, Work stress".
5. After `verify down` and `verify up`, Teeth's story reads the same.
6. `verify doctor` is `ok` with `windowMessages` `[]`, and `grep -c "^Weft failed" <appLog>` prints `0`.

## Not covered

- The History view (#17).

## Traps

- Open a Thread from a Now row's chip by `focus` and Enter: the row's own Open button lies under the chips.
