import {
  WeftError,
  type CalendarDay,
  type EntryId,
  type EntryListItem,
  type Weft,
} from "@weft/contracts";
import { cn } from "cn";
import { CalendarIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { createCapture } from "./capture.ts";
import { Button } from "./components/ui/button.tsx";
import { FieldError } from "./components/ui/field.tsx";
import { Textarea } from "./components/ui/textarea.tsx";
import { DayField } from "./follow-up-date-fields.tsx";
import { followUpLabel } from "./follow-up-date.ts";
import { storyOf } from "./story.ts";
import { messageOf, writtenOn } from "./weft-state.ts";

/**
 * Adds an Update to `entry`, optionally with its own Follow-up date. `asking` is the box a
 * completion opens: "What happened?", with "Nothing to add" to leave it.
 */
export function UpdateComposer({
  weft,
  entry,
  today,
  asking,
  onAdded,
  onNothingToAdd,
}: {
  weft: Weft;
  entry: EntryListItem;
  today: CalendarDay;
  asking: boolean;
  onAdded: (updateId: EntryId) => void;
  onNothingToAdd: () => void;
}) {
  const capture = useMemo(() => createCapture(weft), [weft]);
  const [text, setText] = useState("");
  const [day, setDay] = useState<CalendarDay | "">("");
  const [failure, setFailure] = useState<string>();
  const box = useRef<HTMLTextAreaElement>(null);
  const stillOpen = useRef(true);
  useEffect(() => {
    stillOpen.current = true;
    return () => {
      stillOpen.current = false;
    };
  }, []);

  useEffect(() => {
    if (asking) box.current?.focus();
  }, [asking]);

  async function add() {
    try {
      const updateId = await capture(
        text,
        day ? { day, time: null, repeat: null } : null,
        entry.entryId,
      );
      if (updateId === null || !stillOpen.current) return;
      setText("");
      setDay("");
      setFailure(undefined);
      onAdded(updateId);
    } catch (error) {
      if (!stillOpen.current) return;
      setFailure(
        error instanceof WeftError
          ? `Weft refused this update: ${error.message}`
          : `Weft couldn't save this update: ${messageOf(error)}`,
      );
    }
  }

  const heading = asking ? "What happened?" : "What happened next?";
  return (
    <section aria-label={heading} className="flex flex-col gap-2">
      <h3 className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
        {heading}
      </h3>
      <Textarea
        ref={box}
        aria-label={heading}
        placeholder={
          asking ? "Say what happened, if anything" : "Add an update…"
        }
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            void add();
          }
        }}
        className={cn("min-h-14 resize-none", asking && "border-ring")}
      />
      <div className="flex flex-wrap items-center gap-2">
        <DayField
          value={day}
          onChange={setDay}
          today={today}
          trigger={
            <Button
              type="button"
              variant={day ? "secondary" : "ghost"}
              size="sm"
            >
              <CalendarIcon />
              {day
                ? `Back ${followUpLabel({ day, time: null, repeat: null }, today)}`
                : "Bring back…"}
            </Button>
          }
        />
        <span className="ms-auto flex gap-2">
          {asking && (
            <Button variant="ghost" size="sm" onClick={onNothingToAdd}>
              Nothing to add
            </Button>
          )}
          <Button
            size="sm"
            disabled={text.trim() === ""}
            onClick={() => void add()}
          >
            {asking ? "Save" : "Add update"}
          </Button>
        </span>
      </div>
      <FieldError>{failure}</FieldError>
    </section>
  );
}

/** The first Entry and every Update under it, with `entry` marked. Shown once there are Updates. */
export function StoryList({
  entry,
  entries,
  today,
  onOpen,
}: {
  entry: EntryListItem;
  entries: readonly EntryListItem[];
  today: CalendarDay;
  onOpen: (entryId: EntryId) => void;
}) {
  const lines = useMemo(() => storyOf(entry, entries), [entry, entries]);
  if (lines.length < 2) return null;
  return (
    <section aria-labelledby="entry-story" className="flex flex-col gap-1">
      <h3
        id="entry-story"
        className="mb-1 text-xs font-medium tracking-wider text-muted-foreground uppercase"
      >
        Story · {lines.length}
      </h3>
      <ol className="flex flex-col">
        {lines.map(({ entry: line, depth }) => {
          const current = line.entryId === entry.entryId;
          return (
            <li key={line.entryId} style={{ marginInlineStart: depth * 14 }}>
              <button
                type="button"
                aria-current={current ? "true" : undefined}
                onClick={() => onOpen(line.entryId)}
                className={cn(
                  "flex w-full gap-2 border-s-2 px-2 py-1 text-start text-sm hover:bg-muted",
                  current && "border-s-ring bg-muted",
                  line.putAway && "opacity-50",
                )}
              >
                <span className="w-14 shrink-0 text-xs leading-5 text-muted-foreground">
                  {lineDate(line, today)}
                </span>
                <span>
                  {line.followUpDate ? (
                    <span aria-hidden="true">○ </span>
                  ) : line.completed ? (
                    <span aria-hidden="true" className="text-muted-foreground">
                      ✓{" "}
                    </span>
                  ) : null}
                  {line.body}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function lineDate(entry: EntryListItem, today: CalendarDay): string {
  if (entry.followUpDate) return followUpLabel(entry.followUpDate, today);
  return writtenOn(entry.completed?.at ?? entry.writtenAt);
}

export function FollowsFrom({
  parent,
  onOpen,
}: {
  parent: EntryListItem;
  onOpen: (entryId: EntryId) => void;
}) {
  return (
    <p className="text-sm text-muted-foreground">
      Follows from{" "}
      <button
        type="button"
        onClick={() => onOpen(parent.entryId)}
        className="text-foreground underline underline-offset-2 hover:no-underline"
      >
        {truncate(parent.body, 70)}
      </button>
    </p>
  );
}

export function truncate(text: string, length: number): string {
  return text.length > length
    ? `${text.slice(0, length - 1).trimEnd()}…`
    : text;
}
