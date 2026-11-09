import type { CalendarDay } from "@weft/contracts";
import { useMemo, useState, type ReactElement } from "react";

import { Button } from "./components/ui/button.tsx";
import { Calendar } from "./components/ui/calendar.tsx";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "./components/ui/combobox.tsx";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./components/ui/popover.tsx";
import {
  commonTimes,
  dateOf,
  dayName,
  localDay,
  parseTime,
  quickDays,
  timeName,
} from "./follow-up-date.ts";

/** The Follow-up date's day, "" for none; `trigger` is the button that opens its popover. */
export function DayField({
  value,
  onChange,
  today,
  trigger,
}: {
  value: CalendarDay | "";
  onChange: (day: CalendarDay | "") => void;
  today: CalendarDay;
  trigger: ReactElement;
}) {
  const [open, setOpen] = useState(false);
  function pick(day: CalendarDay | "") {
    onChange(day);
    setOpen(false);
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={trigger} />
      <PopoverContent
        aria-label="Bring back on"
        align="start"
        className="w-auto flex-row gap-0 p-0"
      >
        <div className="flex w-36 flex-col gap-0.5 border-e p-2">
          {quickDays(today).map(({ label, day }) => (
            <Button
              key={label}
              variant={value === day ? "secondary" : "ghost"}
              size="sm"
              className="h-auto flex-col items-start gap-0 py-1.5"
              onClick={() => pick(day)}
            >
              <span>{label}</span>
              <span className="text-xs font-normal text-muted-foreground">
                {dayName(day, today)}
              </span>
            </Button>
          ))}
          {value && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-auto justify-start"
              onClick={() => pick("")}
            >
              No date
            </Button>
          )}
        </div>
        <Calendar
          mode="single"
          // Without required, react-day-picker unselects the chosen day when it is clicked again.
          required
          selected={value ? dateOf(value) : undefined}
          defaultMonth={value ? dateOf(value) : undefined}
          onSelect={(date) => pick(localDay(date))}
          className="p-3"
        />
      </PopoverContent>
    </Popover>
  );
}

/** A time picked from the half hours or typed ("930", "2pm"); value and onChange use "HH:MM", "" for none. */
export function TimeField({
  value,
  onChange,
}: {
  value: string;
  onChange: (time: string) => void;
}) {
  const [query, setQuery] = useState("");
  // The Combobox puts the chosen time's label in the input; that is not a search.
  const typed = query.trim() === (value ? timeName(value) : "") ? "" : query;
  const items = useMemo(() => {
    const q = typed.trim();
    if (q === "") return commonTimes;
    const time = parseTime(q);
    const near = commonTimes.filter(
      (each) => timeName(each).startsWith(q) || each.startsWith(q),
    );
    return time && !near.includes(time) ? [time, ...near] : near;
  }, [typed]);

  function keepTypedTimeOnLeave(open: boolean, { reason }: { reason: string }) {
    if (open || (reason !== "outside-press" && reason !== "focus-out")) return;
    const time = parseTime(typed);
    if (time) onChange(time);
  }

  return (
    <Combobox
      items={items}
      filter={null}
      value={value || null}
      onValueChange={(time) => onChange((time as string | null) ?? "")}
      onInputValueChange={setQuery}
      onOpenChange={keepTypedTimeOnLeave}
      itemToStringLabel={(time: string) => timeName(time)}
      autoHighlight
    >
      <ComboboxInput
        aria-label="Time"
        placeholder="Any time"
        showClear={value !== ""}
        className="w-28"
      />
      <ComboboxContent className="min-w-36">
        <ComboboxEmpty>Type a time, such as 9:30</ComboboxEmpty>
        <ComboboxList>
          {(time: string) => (
            <ComboboxItem key={time} value={time}>
              {timeName(time)}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
