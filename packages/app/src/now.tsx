import {
  calendarDay,
  timeOfDay,
  WeftError,
  type EntryListItem,
  type FollowUpDate,
  type Weft,
} from "@weft/contracts";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import { createCapture } from "./capture.ts";
import { Button } from "./components/ui/button.tsx";
import { Field, FieldError } from "./components/ui/field.tsx";
import { Input } from "./components/ui/input.tsx";
import { followUpLabel, localDay } from "./follow-up-date.ts";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
} from "./components/ui/item.tsx";

/**
 * What the capture box holds: its text, the Follow-up date's day and time as the date and time
 * fields give them (`""` when empty), the last failure, and the commands waiting to be retried.
 * The app keeps it above the tabs, so changing tabs loses none of it.
 */
export function useCaptureBox(weft: Weft) {
  const capture = useMemo(() => createCapture(weft), [weft]);
  const [draft, setDraft] = useState(emptyDraft);
  const [failure, setFailure] = useState<string>();
  const { text, day, time } = draft;
  const setField = (field: keyof Draft) => (value: string) =>
    setDraft((current) => ({ ...current, [field]: value }));

  /** Resolves to true once the Entry is written, with its Follow-up date when it has one. */
  async function submit(): Promise<boolean> {
    const submitted = draft;
    try {
      if (!(await capture(text, followUpDateOf(day, time)))) return false;
      setFailure(undefined);
      setDraft((current) => (current === submitted ? emptyDraft : current));
      return true;
    } catch (error) {
      setFailure(
        error instanceof WeftError
          ? `Weft refused this entry: ${error.message}`
          : `Weft couldn't save this entry: ${messageOf(error)}`,
      );
      return false;
    }
  }

  return {
    text,
    setText: setField("text"),
    day,
    setDay: setField("day"),
    time,
    setTime: setField("time"),
    failure,
    submit,
  };
}

interface Draft {
  readonly text: string;
  readonly day: string;
  readonly time: string;
}

const emptyDraft: Draft = { text: "", day: "", time: "" };

function followUpDateOf(day: string, time: string): FollowUpDate | null {
  if (!day) return null;
  return {
    day: calendarDay(day),
    time: time ? timeOfDay(time) : null,
    repeat: null,
  };
}

export type CaptureBox = ReturnType<typeof useCaptureBox>;

export function NowView({
  weft,
  captureBox: { text, setText, day, setDay, time, setTime, failure, submit },
}: {
  weft: Weft;
  captureBox: CaptureBox;
}) {
  const { entries, failure: listFailure } = useEntries(weft);
  const box = useRef<HTMLInputElement>(null);
  const today = localDay();

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (await submit()) box.current?.focus();
  }

  return (
    <div className="flex flex-col gap-4 p-2">
      <form onSubmit={onSubmit} className="flex flex-col gap-2">
        <Field orientation="horizontal" data-invalid={failure !== undefined}>
          <Input
            ref={box}
            aria-label="What's on your mind?"
            placeholder="What's on your mind?"
            value={text}
            onChange={(event) => setText(event.target.value)}
            aria-invalid={failure !== undefined}
          />
          <Button type="submit" disabled={!text.trim()}>
            Add
          </Button>
        </Field>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <label htmlFor="capture-day">Bring back on</label>
          <Input
            id="capture-day"
            type="date"
            className="w-auto dark:scheme-dark"
            value={day}
            onChange={(event) => setDay(event.target.value)}
          />
          <label htmlFor="capture-time">at</label>
          <Input
            id="capture-time"
            type="time"
            className="w-auto dark:scheme-dark"
            disabled={!day}
            value={time}
            onChange={(event) => setTime(event.target.value)}
          />
        </div>
        <FieldError>{failure}</FieldError>
      </form>
      <FieldError>{listFailure}</FieldError>
      <ItemGroup aria-label="Entries">
        {entries.map((entry) => (
          <Item key={entry.entryId} role="listitem" size="sm">
            <ItemContent>{entry.body}</ItemContent>
            <ItemActions>
              {entry.followUpDate && (
                <time
                  className="text-sm"
                  dateTime={followUpDateTime(entry.followUpDate)}
                >
                  {followUpLabel(entry.followUpDate, today)}
                </time>
              )}
              <ItemDescription>
                <time dateTime={entry.writtenAt}>
                  {writtenOn(entry.writtenAt)}
                </time>
              </ItemDescription>
            </ItemActions>
          </Item>
        ))}
      </ItemGroup>
    </div>
  );
}

function useEntries(weft: Weft) {
  const [entries, setEntries] = useState<readonly EntryListItem[]>([]);
  const [failure, setFailure] = useState<string>();
  useEffect(() => {
    let latest = 0;
    let stopped = false;
    function load() {
      const reading = ++latest;
      weft.read({ type: "entries" }).then(
        (read) => {
          if (stopped || reading !== latest) return;
          setEntries(read);
          setFailure(undefined);
        },
        (error: unknown) => {
          if (stopped || reading !== latest) return;
          setFailure(`Weft couldn't show your entries: ${messageOf(error)}`);
        },
      );
    }
    const unsubscribe = weft.subscribe((change) => {
      if (change.tables.includes("entries")) load();
    });
    load();
    return () => {
      stopped = true;
      unsubscribe();
    };
  }, [weft]);
  return { entries, failure };
}

/** An HTML `datetime` value: `2026-11-09` or `2026-11-09T09:30`. */
function followUpDateTime({ day, time }: FollowUpDate): string {
  return time === null ? day : `${day}T${time}`;
}

function writtenOn(instant: string): string {
  const date = new Date(instant);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year:
      date.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  });
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
