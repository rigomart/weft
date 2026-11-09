import {
  timeOfDay,
  WeftError,
  type CalendarDay,
  type EntryId,
  type EntryListItem,
  type FollowUpDate,
  type Weft,
} from "@weft/contracts";
import { cn } from "cn";
import { CalendarIcon, CheckIcon } from "lucide-react";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type RefObject,
} from "react";

import { createCapture } from "./capture.ts";
import { createCompletion } from "./complete.ts";
import { Button } from "./components/ui/button.tsx";
import { Card, CardContent } from "./components/ui/card.tsx";
import { FieldError } from "./components/ui/field.tsx";
import { Input } from "./components/ui/input.tsx";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemGroup,
  ItemMedia,
} from "./components/ui/item.tsx";
import { Separator } from "./components/ui/separator.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./components/ui/tooltip.tsx";
import { DayField, TimeField } from "./follow-up-date-fields.tsx";
import {
  dayName,
  followUpLabel,
  localDay,
  repeatLabel,
  timeName,
  weekdayOf,
} from "./follow-up-date.ts";
import { glance, type Glance, type GroupName } from "./glance.ts";
import {
  noRepeat,
  RepeatField,
  repeatOf,
  startRepeat,
  type RepeatDraft,
} from "./repeat-field.tsx";

/**
 * The capture box's draft, its last failure and the commands waiting to be retried.
 * The app keeps it above the tabs, so changing tabs loses none of it.
 */
export function useCaptureBox(weft: Weft) {
  const capture = useMemo(() => createCapture(weft), [weft]);
  const [draft, setDraft] = useState(emptyDraft);
  const [failure, setFailure] = useState<string>();
  const { text, day, time, repeat } = draft;
  const followUpDate = followUpDateOf(draft);
  const setField =
    <Field extends "text" | "time">(field: Field) =>
    (value: Draft[Field]) =>
      setDraft((current) => ({ ...current, [field]: value }));

  /** Resolves to true once the Entry is written, with its Follow-up date when it has one. */
  async function submit(): Promise<boolean> {
    const submitted = draft;
    if (followUpDate === "incomplete") return false;
    try {
      if (!(await capture(text, followUpDate))) return false;
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
    setDay: (day: CalendarDay | "") =>
      setDraft((current) =>
        day
          ? { ...current, day }
          : { ...current, day, time: "", repeat: noRepeat },
      ),
    time,
    setTime: setField("time"),
    repeat,
    setRepeat: (value: RepeatDraft) =>
      setDraft((current) => ({ ...current, repeat: value })),
    chooseRepeatKind: (kind: RepeatDraft["kind"]) =>
      setDraft((current) => ({
        ...current,
        repeat: startRepeat(kind, chosenDay(current.day)),
      })),
    ready: text.trim() !== "" && followUpDate !== "incomplete",
    failure,
    submit,
  };
}

interface Draft {
  readonly text: string;
  readonly day: CalendarDay | "";
  readonly time: string;
  readonly repeat: RepeatDraft;
}

const emptyDraft: Draft = { text: "", day: "", time: "", repeat: noRepeat };

function followUpDateOf({
  day,
  time,
  repeat,
}: Draft): FollowUpDate | null | "incomplete" {
  if (!day) return null;
  const chosen = repeatOf(repeat);
  if (chosen === "incomplete") return "incomplete";
  return { day, time: time ? timeOfDay(time) : null, repeat: chosen };
}

function chosenDay(day: CalendarDay | "") {
  return day ? { weekday: weekdayOf(day), date: Number(day.slice(8)) } : null;
}

export type CaptureBox = ReturnType<typeof useCaptureBox>;

export function NowView({
  weft,
  captureBox,
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
  const { comingBack, onComplete } = useFocusAfterCompleting(
    complete,
    groups,
    box,
  );
  const asking = groups.filter(
    (group) => group.name === "Late" || group.name === "Today",
  );
  const comingUp = groups.filter((group) => !asking.includes(group));

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (await captureBox.submit()) box.current?.focus();
  }

  const row = (entry: EntryListItem, group: GroupName, quiet = false) => (
    <EntryRow
      key={entry.entryId}
      entry={entry}
      group={group}
      today={today}
      quiet={quiet}
      completing={completing.has(entry.entryId)}
      onComplete={onComplete}
    />
  );

  return (
    <TooltipProvider>
      <div className="mx-auto grid max-w-[1060px] gap-x-12 gap-y-8 px-8 pt-6 pb-16 md:grid-cols-[minmax(0,1fr)_16.5rem]">
        <main className="flex min-w-0 flex-col">
          <h1 className="text-2xl font-semibold tracking-tight">
            {dayName(today, today, true)}
          </h1>
          <CaptureForm
            captureBox={captureBox}
            today={today}
            box={box}
            onSubmit={onSubmit}
          />
          <FieldError className="mt-3">{listFailure}</FieldError>
          <FieldError className="mt-3">{completeFailure}</FieldError>
          <div ref={comingBack} className="mt-6 flex flex-col gap-6">
            {groups.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Nothing is coming back.
              </p>
            )}
            {asking.map((group) => (
              <section
                key={group.name}
                aria-labelledby={headingId(group.name)}
                className="flex flex-col gap-2"
              >
                <GroupHeading
                  name={group.name}
                  count={group.entries.length}
                  className="text-base font-semibold"
                />
                <ItemGroup aria-labelledby={headingId(group.name)}>
                  {group.entries.map((entry) => row(entry, group.name))}
                </ItemGroup>
              </section>
            ))}
            {comingUp.length > 0 && (
              <div className="flex flex-col gap-2">
                {asking.length > 0 && <Separator />}
                {comingUp.map((group) => (
                  <section
                    key={group.name}
                    aria-labelledby={headingId(group.name)}
                    className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-x-4"
                  >
                    <GroupHeading
                      name={group.name}
                      count={group.entries.length}
                      className="pt-2.5 text-sm font-medium"
                    />
                    <ItemGroup aria-labelledby={headingId(group.name)}>
                      {group.entries.map((entry) =>
                        row(entry, group.name, true),
                      )}
                    </ItemGroup>
                  </section>
                ))}
              </div>
            )}
          </div>
        </main>
        <aside>
          <section
            aria-labelledby={headingId("Loose")}
            className="flex flex-col"
          >
            <GroupHeading
              name="Loose"
              count={loose.length}
              className="text-base font-semibold"
            />
            <p className="text-sm text-muted-foreground">
              On no thread, and fine as they are.
            </p>
            <Separator className="my-3" />
            <ItemGroup aria-labelledby={headingId("Loose")}>
              {loose.map((entry) => (
                <Item key={entry.entryId} role="listitem" size="xs">
                  <ItemContent>
                    <span>{entry.body}</span>
                    <time
                      dateTime={entry.writtenAt}
                      className="text-xs text-muted-foreground"
                    >
                      {writtenOn(entry.writtenAt)}
                    </time>
                  </ItemContent>
                </Item>
              ))}
            </ItemGroup>
            {loose.length === 0 && (
              <p className="text-sm text-muted-foreground">Nothing loose.</p>
            )}
          </section>
        </aside>
      </div>
    </TooltipProvider>
  );
}

function CaptureForm({
  captureBox: {
    text,
    setText,
    day,
    setDay,
    time,
    setTime,
    repeat,
    setRepeat,
    chooseRepeatKind,
    ready,
    failure,
  },
  today,
  box,
  onSubmit,
}: {
  captureBox: CaptureBox;
  today: CalendarDay;
  box: RefObject<HTMLInputElement | null>;
  onSubmit: (event: FormEvent) => void;
}) {
  return (
    <Card size="sm" className="mt-4">
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <Input
            ref={box}
            aria-label="What's on your mind?"
            placeholder="What's on your mind?"
            value={text}
            onChange={(event) => setText(event.target.value)}
            aria-invalid={failure !== undefined}
          />
          <div className="flex flex-wrap items-center gap-2">
            <DayField
              value={day}
              onChange={setDay}
              today={today}
              trigger={
                <Button type="button" variant={day ? "secondary" : "ghost"}>
                  <CalendarIcon />
                  {day ? `Back ${backLabel(day, today)}` : "Bring back…"}
                </Button>
              }
            />
            {day && (
              <>
                <TimeField value={time} onChange={setTime} />
                <RepeatField
                  value={repeat}
                  onKind={chooseRepeatKind}
                  onChange={setRepeat}
                />
              </>
            )}
            <Button type="submit" disabled={!ready} className="ms-auto">
              Add
            </Button>
          </div>
          <FieldError>{failure}</FieldError>
        </form>
      </CardContent>
    </Card>
  );
}

function backLabel(day: CalendarDay, today: CalendarDay): string {
  return followUpLabel({ day, time: null, repeat: null }, today).replace(
    /^(Today|Tomorrow)/,
    (word) => word.toLowerCase(),
  );
}

function EntryRow({
  entry,
  group,
  today,
  quiet,
  completing,
  onComplete,
}: {
  entry: EntryListItem;
  group: GroupName;
  today: CalendarDay;
  quiet: boolean;
  completing: boolean;
  onComplete: (entry: EntryListItem, button: HTMLButtonElement) => void;
}) {
  const date = entry.followUpDate!;
  return (
    <Item
      role="listitem"
      variant={quiet ? "default" : "outline"}
      size={quiet ? "xs" : "sm"}
    >
      <ItemMedia>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="outline"
                size={quiet ? "icon-xs" : "icon-sm"}
                aria-label={`Complete "${entry.body}"`}
                data-complete=""
                disabled={completing}
                onClick={(event) => onComplete(entry, event.currentTarget)}
              />
            }
          >
            <CheckIcon />
          </TooltipTrigger>
          <TooltipContent>Complete</TooltipContent>
        </Tooltip>
      </ItemMedia>
      <ItemContent className="min-w-64">
        <span>{entry.body}</span>
      </ItemContent>
      <ItemActions className="ms-auto text-muted-foreground">
        {date.repeat && (
          <span>
            <span aria-hidden="true">↻ </span>
            {repeatLabel(date.repeat)}
          </span>
        )}
        <time
          dateTime={followUpDateTime(date)}
          className={cn(group === "Late" && "text-late")}
        >
          {dateUnlessGroupSaysIt(date, group, today)}
        </time>
      </ItemActions>
    </Item>
  );
}

function useFocusAfterCompleting(
  complete: (entry: EntryListItem) => Promise<boolean>,
  groups: Glance["groups"],
  box: RefObject<HTMLInputElement | null>,
) {
  const comingBack = useRef<HTMLDivElement>(null);
  const refocus = useRef<{ button: HTMLButtonElement; at: number } | null>(
    null,
  );

  function completeButtons(): HTMLButtonElement[] {
    return [
      ...(comingBack.current?.querySelectorAll<HTMLButtonElement>(
        "button[data-complete]",
      ) ?? []),
    ];
  }

  async function onComplete(entry: EntryListItem, button: HTMLButtonElement) {
    if (document.activeElement === button) {
      refocus.current = { button, at: completeButtons().indexOf(button) };
    }
    if (!(await complete(entry)) && refocus.current?.button === button) {
      refocus.current = null;
    }
  }

  useLayoutEffect(() => {
    const pending = refocus.current;
    if (!pending || pending.button.isConnected) return;
    refocus.current = null;
    if (document.activeElement !== document.body) return;
    const buttons = completeButtons();
    (buttons[Math.min(pending.at, buttons.length - 1)] ?? box.current)?.focus();
  }, [groups]);

  return { comingBack, onComplete };
}

function dateUnlessGroupSaysIt(
  date: FollowUpDate,
  group: GroupName,
  today: CalendarDay,
): string {
  if (group !== "Today" && group !== "Tomorrow") {
    return followUpLabel(date, today);
  }
  return date.time === null ? "" : timeName(date.time);
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

function GroupHeading({
  name,
  count,
  className,
}: {
  name: string;
  count: number;
  className: string;
}) {
  return (
    <h2
      id={headingId(name)}
      className={cn(
        "flex items-baseline gap-2",
        name === "Late" && "text-late",
        className,
      )}
    >
      <span>{name}</span>
      <span className="text-sm font-normal text-muted-foreground">{count}</span>
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
