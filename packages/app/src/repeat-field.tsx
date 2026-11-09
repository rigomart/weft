import type { Repeat } from "@weft/contracts";

import { Input } from "./components/ui/input.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./components/ui/select.tsx";
import { ToggleGroup, ToggleGroupItem } from "./components/ui/toggle-group.tsx";
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
  onKind,
  onChange,
}: {
  value: RepeatDraft;
  onKind: (kind: RepeatDraft["kind"]) => void;
  onChange: (value: RepeatDraft) => void;
}) {
  return (
    <>
      <Select
        items={kinds}
        value={value.kind}
        onValueChange={(kind) => kind && onKind(kind)}
      >
        <SelectTrigger aria-label="Repeat">
          <span aria-hidden="true" className="text-muted-foreground">
            ↻
          </span>
          <SelectValue />
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false}>
          {kinds.map((kind) => (
            <SelectItem key={kind.value} value={kind.value}>
              {kind.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {value.kind !== "none" && (
        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
          {value.kind === "days" && (
            <>
              every
              <DigitsField
                label="Days between"
                value={value.every}
                onChange={(every) => onChange({ ...value, every })}
              />
              days
            </>
          )}
          {value.kind === "weekly" && (
            <>
              on
              <ToggleGroup
                multiple
                aria-label="Weekdays"
                variant="outline"
                size="sm"
                spacing={0}
                value={value.weekdays.map(String)}
                onValueChange={(chosen) =>
                  onChange({ ...value, weekdays: chosen.map(Number) })
                }
              >
                {weekdays.map((weekday) => (
                  <ToggleGroupItem
                    key={weekday}
                    value={String(weekday)}
                    aria-label={weekdayName(weekday, "long")}
                  >
                    {weekdayName(weekday, "short").slice(0, 2)}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </>
          )}
          {value.kind === "monthly" && (
            <>
              on day
              <DigitsField
                label="Day of the month"
                value={value.day}
                onChange={(day) => onChange({ ...value, day })}
              />
            </>
          )}
        </span>
      )}
    </>
  );
}

function DigitsField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Input
      aria-label={label}
      inputMode="numeric"
      className="w-14"
      value={value}
      onChange={(event) => onChange(event.target.value.replace(/\D/g, ""))}
    />
  );
}
