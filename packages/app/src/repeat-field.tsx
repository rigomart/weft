import type { Repeat } from "@weft/contracts";

import { Button } from "./components/ui/button.tsx";
import { Input } from "./components/ui/input.tsx";
import { weekdayName } from "./follow-up-date.ts";

/** A Repeat as it is being chosen, with numbers as their fields give them. */
export type RepeatDraft =
  | { readonly kind: "none" }
  | { readonly kind: "days"; readonly every: string }
  | { readonly kind: "weekly"; readonly weekdays: readonly number[] }
  | { readonly kind: "monthly"; readonly day: string };

export const noRepeat: RepeatDraft = { kind: "none" };

/** "incomplete" while no weekday is chosen or a number is out of range. */
export function repeatOf(draft: RepeatDraft): Repeat | null | "incomplete" {
  switch (draft.kind) {
    case "none":
      return null;
    case "days": {
      const every = wholeNumber(draft.every, 1, 365);
      return every === undefined ? "incomplete" : { kind: "days", every };
    }
    case "weekly":
      return draft.weekdays.length === 0
        ? "incomplete"
        : {
            kind: "weekly",
            weekdays: [...draft.weekdays].sort((a, b) => a - b),
          };
    case "monthly": {
      const day = wholeNumber(draft.day, 1, 31);
      return day === undefined ? "incomplete" : { kind: "monthly", day };
    }
  }
}

function wholeNumber(text: string, min: number, max: number) {
  const n = Number(text);
  return text.trim() !== "" && Number.isInteger(n) && n >= min && n <= max
    ? n
    : undefined;
}

/**
 * A new draft of `kind`, starting from the Follow-up date's day when one is chosen: weekly on its
 * weekday, monthly on its date.
 */
export function startRepeat(
  kind: RepeatDraft["kind"],
  day: { weekday: number; date: number } | null,
): RepeatDraft {
  switch (kind) {
    case "none":
      return noRepeat;
    case "days":
      return { kind, every: "1" };
    case "weekly":
      return { kind, weekdays: day ? [day.weekday] : [] };
    case "monthly":
      return { kind, day: day ? String(day.date) : "1" };
  }
}

const kinds: readonly { value: RepeatDraft["kind"]; label: string }[] = [
  { value: "none", label: "Once" },
  { value: "days", label: "Every few days" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

const weekdays = [0, 1, 2, 3, 4, 5, 6];

export function RepeatField({
  value,
  disabled,
  onKind,
  onChange,
}: {
  value: RepeatDraft;
  disabled: boolean;
  onKind: (kind: RepeatDraft["kind"]) => void;
  onChange: (value: RepeatDraft) => void;
}) {
  return (
    <>
      <select
        aria-label="Repeat"
        className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30 dark:scheme-dark"
        disabled={disabled}
        value={value.kind}
        onChange={(event) => onKind(event.target.value as RepeatDraft["kind"])}
      >
        {kinds.map((kind) => (
          <option key={kind.value} value={kind.value}>
            {kind.label}
          </option>
        ))}
      </select>
      {!disabled && value.kind === "days" && (
        <>
          <span>every</span>
          <Input
            aria-label="Days between"
            type="number"
            min={1}
            max={365}
            className="w-16"
            value={value.every}
            onChange={(event) =>
              onChange({ ...value, every: event.target.value })
            }
          />
          <span>days</span>
        </>
      )}
      {!disabled && value.kind === "weekly" && (
        <>
          <span>on</span>
          <span role="group" aria-label="Weekdays" className="flex gap-1">
            {weekdays.map((weekday) => {
              const on = value.weekdays.includes(weekday);
              return (
                <Button
                  key={weekday}
                  type="button"
                  variant={on ? "default" : "outline"}
                  size="xs"
                  aria-pressed={on}
                  onClick={() =>
                    onChange({
                      ...value,
                      weekdays: on
                        ? value.weekdays.filter((w) => w !== weekday)
                        : [...value.weekdays, weekday],
                    })
                  }
                >
                  {weekdayName(weekday, "short")}
                </Button>
              );
            })}
          </span>
        </>
      )}
      {!disabled && value.kind === "monthly" && (
        <>
          <span>on day</span>
          <Input
            aria-label="Day of the month"
            type="number"
            min={1}
            max={31}
            className="w-16"
            value={value.day}
            onChange={(event) =>
              onChange({ ...value, day: event.target.value })
            }
          />
        </>
      )}
    </>
  );
}
