# Repeat a follow-up date

After a day is chosen in the capture box, the Repeat select (`combobox "Repeat"`) offers Once, Every few days, Weekly and Monthly. Every few days shows "every [N] days" (`Days between`, 1 to 365, starting at 1). Weekly shows a weekday toggle for each day (`group "Weekdays"`, `aria-pressed`), starting on the chosen day's weekday. Monthly shows "on day [N]" (`Day of the month`, 1 to 31), starting at the chosen day's date. Add is off while the Repeat cannot be one (no weekday, a number out of range).

A card with a Repeat shows "↻ <rhythm>" before its date: "every Sunday", "every Mon, Wed", "every 3 days", "every month on the 15th". Completing it writes one "follow-up date completed" whose `next` is the Repeat's first occurrence after both the completed day and today, so missed occurrences collapse into one. The same Entry moves to that day's group, and nothing is copied.

## Entry points and variants

- Each Repeat kind, chosen with `select @<ref> "<option>"`
- ✓ on a repeating card that is Late, and on one that is due Today
- Quit and relaunch

## Preconditions

- A new instance name, connected with agent-browser
- Today's date (`eval "new Date().toString()"`); the example values below are for Sunday 2026-11-08
- Fill the day first: the Repeat is off until then. Type a number field with `fill @<ref> <n>`.

## Checks

Read Now with this `eval`. Each item is `<body> | <footer text> | <datetime>`, the footer being the rhythm and the date label:

`JSON.stringify([...document.querySelectorAll('[role=tabpanel]:not([inert]) section')].map(s => [s.querySelector('h2').firstChild.textContent, s.querySelector('h2').lastChild.textContent, [...s.querySelectorAll('[role=listitem]')].map(i => i.firstChild.textContent + ' | ' + i.querySelector('[data-slot=item-description]')?.textContent + ' | ' + i.querySelector('time').getAttribute('datetime'))]))`

1. Type "Water the plants", choose last Sunday, select Weekly: only Sun is pressed. Add. Now shows `["Late","1",["Water the plants | ↻ every SundayNov 1 | 2026-11-01"]]`, and the Repeat select is back to `none` and off.
2. `verify db "SELECT type, content FROM events ORDER BY hlc"`: the "follow-up date set" has `"repeat":{"kind":"weekly","weekdays":[0]}`.
3. Click ✓ on it. Now shows `["Later","1",["Water the plants | ↻ every SundayNov 15 | 2026-11-15"]]` (next Sunday; This week when that is under seven days away), Late is gone, Loose is empty, and `verify db "SELECT count(*) FROM entries"` is `1`. The last event is one "follow-up date completed" with `completed.day` `2026-11-01` and `next` `{"day":"2026-11-15","time":null,"repeat":{"kind":"weekly","weekdays":[0]}}`.
4. "Stretch" today, Every few days, `fill` 3: Today shows `Stretch | ↻ every 3 daysToday`. "Pay the rent" on the 15th, Monthly: `Day of the month` reads `15`, and the card shows `↻ every month on the 15th`. ✓ on "Stretch" moves it to This week, three days on (`Wed | 2026-11-11`).
5. After `verify down` and `verify up`, the `eval` gives the same.
6. `verify doctor` is `ok` with `windowMessages` `[]`, and `grep -c "^Weft failed" <appLog>` prints `0`.

## Not covered

- Editing or removing a Repeat later (#12).
- A Repeat that would pass 9999-12-31, which the store fails on; no date field reaches it.

## Traps

- The date field reports a day as it is typed, with years such as `0002` on the way to `2026`. Add stays off until the year is whole.
