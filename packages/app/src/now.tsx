import {
  calendarDay,
  timeOfDay,
  WeftError,
  type CalendarDay,
  type EntryId,
  type EntryListItem,
  type FollowUpDate,
  type Weft,
} from "@weft/contracts";
import { cn } from "cn";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";

import { createCapture } from "./capture.ts";
import { createCompletion } from "./complete.ts";
import { Button } from "./components/ui/button.tsx";
import { Field, FieldError } from "./components/ui/field.tsx";
import { Input } from "./components/ui/input.tsx";
import { followUpLabel, localDay } from "./follow-up-date.ts";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
} from "./components/ui/item.tsx";
import { glance } from "./glance.ts";

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
  const today = useToday();
  const { groups, loose } = useMemo(
    () => glance(entries, today),
    [entries, today],
  );
  const box = useRef<HTMLInputElement>(null);
  const {
    completing,
    failure: completeFailure,
    complete,
  } = useCompletion(weft);
  const comingBack = useRef<HTMLDivElement>(null);
  const refocus = useRef<{ button: HTMLButtonElement; at: number } | null>(
    null,
  );

  async function onComplete(entry: EntryListItem, button: HTMLButtonElement) {
    if (document.activeElement === button) {
      refocus.current = { button, at: completeButtons().indexOf(button) };
    }
    if (!(await complete(entry)) && refocus.current?.button === button) {
      refocus.current = null;
    }
  }

  function completeButtons(): HTMLButtonElement[] {
    return [
      ...(comingBack.current?.querySelectorAll<HTMLButtonElement>(
        "button[data-complete]",
      ) ?? []),
    ];
  }

  // A completed card unmounts with its focused ✓: focus the ✓ that took its place, or the box.
  useLayoutEffect(() => {
    const pending = refocus.current;
    if (!pending || pending.button.isConnected) return;
    refocus.current = null;
    if (document.activeElement !== document.body) return;
    const buttons = completeButtons();
    (buttons[Math.min(pending.at, buttons.length - 1)] ?? box.current)?.focus();
  }, [groups]);

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
      <FieldError>{completeFailure}</FieldError>
      <div className="grid items-start gap-6 md:grid-cols-[minmax(0,1fr)_18rem]">
        <div ref={comingBack} className="flex flex-col gap-5">
          {groups.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nothing is coming back.
            </p>
          )}
          {groups.map((group) => (
            <section
              key={group.name}
              aria-labelledby={headingId(group.name)}
              className="flex flex-col gap-2"
            >
              <GroupHeading name={group.name} count={group.entries.length} />
              <ItemGroup
                aria-labelledby={headingId(group.name)}
                className="grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-2"
              >
                {group.entries.map((entry) => (
                  <Item
                    key={entry.entryId}
                    role="listitem"
                    variant="outline"
                    size="sm"
                    className={cn(
                      "relative flex-col items-stretch gap-1",
                      group.name === "Late" && "border-late/40 bg-late/5",
                    )}
                  >
                    <ItemContent className="pr-7">{entry.body}</ItemContent>
                    <Button
                      variant="outline"
                      size="icon-xs"
                      className="absolute top-2 right-2 rounded-full text-muted-foreground hover:text-foreground"
                      aria-label={`Complete "${entry.body}"`}
                      title="Complete"
                      disabled={completing.has(entry.entryId)}
                      data-complete=""
                      onClick={(event) =>
                        onComplete(entry, event.currentTarget)
                      }
                    >
                      ✓
                    </Button>
                    <ItemDescription
                      className={cn(
                        "self-end text-xs",
                        group.name === "Late" && "text-late",
                      )}
                    >
                      <time dateTime={followUpDateTime(entry.followUpDate!)}>
                        {followUpLabel(entry.followUpDate!, today)}
                      </time>
                    </ItemDescription>
                  </Item>
                ))}
              </ItemGroup>
            </section>
          ))}
        </div>
        <section
          aria-labelledby={headingId("Loose")}
          className="flex flex-col gap-2"
        >
          <GroupHeading name="Loose" count={loose.length} />
          <p className="text-xs text-muted-foreground">
            On no thread, and fine as they are.
          </p>
          <ItemGroup aria-labelledby={headingId("Loose")} className="gap-1.5">
            {loose.map((entry) => (
              <Item
                key={entry.entryId}
                role="listitem"
                variant="outline"
                size="xs"
              >
                <ItemContent className="line-clamp-2">{entry.body}</ItemContent>
                <ItemDescription className="text-xs">
                  <time dateTime={entry.writtenAt}>
                    {writtenOn(entry.writtenAt)}
                  </time>
                </ItemDescription>
              </Item>
            ))}
          </ItemGroup>
          {loose.length === 0 && (
            <p className="text-sm text-muted-foreground">Nothing loose.</p>
          )}
        </section>
      </div>
    </div>
  );
}

function useCompletion(weft: Weft) {
  const completeOne = useMemo(() => createCompletion(weft), [weft]);
  const [completing, setCompleting] = useState<ReadonlySet<EntryId>>(
    () => new Set(),
  );
  const [failure, setFailure] = useState<string>();

  /** Resolves to true once the Follow-up date is completed. */
  async function complete(entry: EntryListItem): Promise<boolean> {
    const { entryId, followUpDate } = entry;
    if (followUpDate === null || completing.has(entryId)) return false;
    setCompleting((current) => new Set(current).add(entryId));
    try {
      await completeOne(entryId, followUpDate);
      setFailure(undefined);
      return true;
    } catch (error) {
      setFailure(
        error instanceof WeftError
          ? `Weft refused to complete "${entry.body}": ${error.message}`
          : `Weft couldn't complete "${entry.body}": ${messageOf(error)}`,
      );
      return false;
    } finally {
      setCompleting((current) => {
        const next = new Set(current);
        next.delete(entryId);
        return next;
      });
    }
  }

  return { completing, failure, complete };
}

function GroupHeading({ name, count }: { name: string; count: number }) {
  return (
    <h2
      id={headingId(name)}
      className={cn(
        "flex items-baseline gap-2 border-b pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase",
        (name === "Today" || name === "Late") && "text-sm",
        name === "Today" && "text-foreground",
        name === "Late" && "text-late",
      )}
    >
      <span>{name}</span>
      <span className="font-normal tabular-nums">{count}</span>
    </h2>
  );
}

function headingId(name: string): string {
  return `now-${name.toLowerCase().replace(" ", "-")}`;
}

/** Today on this device's calendar, moving on at local midnight and when the window comes back. */
function useToday(): CalendarDay {
  const [today, setToday] = useState(() => localDay());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    function check() {
      setToday(localDay());
      clearTimeout(timer);
      const midnight = new Date();
      midnight.setHours(24, 0, 0, 0);
      timer = setTimeout(check, midnight.getTime() - Date.now() + 50);
    }
    check();
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, []);
  return today;
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
      if (
        change.tables.includes("entries") ||
        change.tables.includes("entryThreads")
      ) {
        load();
      }
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
