# Repeat a follow-up date

Once a day is chosen in the capture box, the Repeat select (`combobox "Repeat"`, "↻ Once") appears beside the time. It offers Once, Every few days, Weekly and Monthly. Every few days shows "every [N] days" (`Days between`, 1 to 365, starting at 1). Weekly shows a toggle for each weekday (`group "Weekdays"`, buttons named by the full weekday such as `button "Sunday"`, `aria-pressed`, labelled "Su" to "Sa"), starting on the chosen day's weekday. Monthly shows "on day [N]" (`Day of the month`, 1 to 31), starting at the chosen day's date. The number fields take digits only. Add is off while the Repeat cannot be one (no weekday, a number out of range). The Repeat is hidden again, back at Once, once the Entry is added or the day is cleared with "No date".

A row with a Repeat shows "↻ <rhythm>" before its date: "every Sunday", "every Mon, Wed", "every 3 days", "every month on the 15th". Completing it writes one "follow-up date completed" whose `next` is the Repeat's first occurrence after both the completed day and today, so missed occurrences collapse into one. The same Entry moves to that day's group, and nothing is copied.

## Entry points and variants

- Each Repeat kind, chosen by clicking `combobox "Repeat"`, then `find role option click --name "<option>"` once that option is visible
- ✓ on a repeating row that is Late, and on one that is due Today
- Quit and relaunch

## Preconditions

- A new instance name, connected with agent-browser
- Today's date (`eval "new Date().toString()"`); the example values below are for Sunday 2026-11-08
- Choose the day first, as [Capture an entry](capture-an-entry.md) says: the Repeat is not shown until then. Type a number field with `fill @<ref> <n>`.

## Checks

Read Now with this `eval`. Each item is `<body> | <rhythm and date> | <datetime>`:

`JSON.stringify([...document.querySelectorAll('[role=tabpanel]:not([inert]) section')].map(s => [s.querySelector('h2').firstChild.textContent, s.querySelector('h2').lastChild.textContent, [...s.querySelectorAll('[role=listitem]')].map(i => i.querySelector('[data-slot=item-content] > span').textContent + ' | ' + i.querySelector('[data-slot=item-actions]')?.textContent + ' | ' + i.querySelector('time').getAttribute('datetime'))]))`

1. Type "Water the plants", choose last Sunday in the calendar, select Weekly: only `button "Sunday"` is pressed. Add. Now shows `["Late","1",["Water the plants | ↻ every SundayNov 1 | 2026-11-01"]]`, and `combobox "Repeat"` is gone until a day is chosen again.
2. `verify db "SELECT type, content FROM events ORDER BY hlc"`: the "follow-up date set" has `"repeat":{"kind":"weekly","weekdays":[0]}`.
3. Click ✓ on it. Now shows `["Later","1",["Water the plants | ↻ every SundayNov 15 | 2026-11-15"]]` (next Sunday; This week when that is under seven days away), Late is gone, Loose is empty, and `verify db "SELECT count(*) FROM entries"` is `1`. The last event is one "follow-up date completed" with `completed.day` `2026-11-01` and `next` `{"day":"2026-11-15","time":null,"repeat":{"kind":"weekly","weekdays":[0]}}`.
4. "Stretch" today, Every few days, `fill` 3: Today shows `Stretch | ↻ every 3 days`, with no day after it. "Pay the rent" on the 15th, Monthly: `Day of the month` reads `15`, and the row shows `↻ every month on the 15th`. ✓ on "Stretch" moves it to This week, three days on (`Wed | 2026-11-11`).
5. After `verify down` and `verify up`, the `eval` gives the same.
6. `verify doctor` is `ok` with `windowMessages` `[]`, and `grep -c "^Weft failed" <appLog>` prints `0`.

## Not covered

- Editing or removing a Repeat later (#12).
- A Repeat that would pass 9999-12-31, which the store fails on; no date field reaches it.

## Traps

- A closed Select keeps its options in the DOM, and the Time field's half hours are options too. Wait until the Repeat option you want is visible (`checkVisibility()` returns true) before clicking it by name, or a closed list's option can match first.
