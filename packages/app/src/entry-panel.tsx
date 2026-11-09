import {
  timeOfDay,
  WeftError,
  type CalendarDay,
  type Command,
  type EntryId,
  type EntryListItem,
  type FollowUpDate,
  type ThreadId,
  type ThreadListItem,
  type Weft,
} from "@weft/contracts";
import { CalendarIcon, CheckIcon, XIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { createCompletion } from "./complete.ts";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "./components/ui/alert-dialog.tsx";
import { Button } from "./components/ui/button.tsx";
import { FieldError } from "./components/ui/field.tsx";
import { Separator } from "./components/ui/separator.tsx";
import { FollowsFrom, StoryList, UpdateComposer } from "./entry-story.tsx";
import { SidePanel } from "./side-panel.tsx";
import { Textarea } from "./components/ui/textarea.tsx";
import { DayField, TimeField } from "./follow-up-date-fields.tsx";
import { followUpLabel, weekdayOf } from "./follow-up-date.ts";
import { newId } from "./new-id.ts";
import {
  draftOf,
  RepeatField,
  repeatOf,
  startRepeat,
  type RepeatDraft,
} from "./repeat-field.tsx";
import { ThreadChip } from "./thread-chip.tsx";
import { ThreadPicker, type ThreadChoice } from "./thread-picker.tsx";
import { messageOf, writtenOn } from "./weft-state.ts";

type EntryCommand = Command extends infer C
  ? C extends { readonly entryId: unknown; readonly eventId: unknown }
    ? Omit<C, "eventId" | "entryId">
    : never
  : never;

/**
 * The side panel for one Entry: its body to edit, its Follow-up date, and putting it away or
 * deleting it. Escape or × closes it.
 */
export function EntryPanel({
  weft,
  entry,
  entries,
  threads,
  today,
  asking,
  onAsking,
  onClose,
  onOpen,
  onOpenThread,
}: {
  weft: Weft;
  entry: EntryListItem;
  entries: readonly EntryListItem[];
  threads: readonly ThreadListItem[];
  today: CalendarDay;
  /** Whether the Update box asks what happened, after a completion. */
  asking: boolean;
  onAsking: (asking: boolean) => void;
  onClose: () => void;
  onOpen: (entryId: EntryId) => void;
  onOpenThread: (thread: ThreadListItem) => void;
}) {
  const parent =
    entry.parentEntryId === null
      ? undefined
      : entries.find((each) => each.entryId === entry.parentEntryId);
  const [failure, setFailure] = useState<string>();
  const complete = useMemo(() => createCompletion(weft), [weft]);

  async function run(command: EntryCommand): Promise<boolean> {
    try {
      await weft.run({
        ...command,
        eventId: newId("event"),
        entryId: entry.entryId,
      } as Command);
      setFailure(undefined);
      return true;
    } catch (error) {
      setFailure(failureMessage(error));
      return false;
    }
  }

  const puttingOnThread = useRef(false);

  async function putOnThread(choice: ThreadChoice) {
    if (puttingOnThread.current) return;
    puttingOnThread.current = true;
    try {
      if (choice.kind === "thread") {
        await run({
          type: "put entry on thread",
          threadId: choice.thread.threadId,
        });
        return;
      }
      const threadId = newId("thread");
      try {
        await weft.run({
          type: "start thread",
          eventId: newId("event"),
          threadId,
          name: choice.name,
        });
      } catch (error) {
        setFailure(failureMessage(error));
        return;
      }
      await run({ type: "put entry on thread", threadId });
    } finally {
      puttingOnThread.current = false;
    }
  }

  async function onComplete() {
    if (entry.followUpDate === null) return;
    try {
      await complete(entry.entryId, entry.followUpDate);
      setFailure(undefined);
      onAsking(true);
    } catch (error) {
      setFailure(failureMessage(error));
    }
  }

  return (
    <SidePanel
      title={panelTitle(entry)}
      label={panelTitle(entry)}
      onClose={onClose}
    >
      {parent && <FollowsFrom parent={parent} onOpen={onOpen} />}
      <BodyField
        entry={entry}
        onSave={(body) => run({ type: "edit entry", body })}
      />
      <FollowUpDateRow
        entry={entry}
        today={today}
        onSet={(followUpDate) =>
          run({ type: "set follow-up date", followUpDate })
        }
        onClear={() => run({ type: "clear follow-up date" })}
        onComplete={onComplete}
      />
      <UpdateComposer
        weft={weft}
        entry={entry}
        today={today}
        asking={asking}
        onAdded={onOpen}
        onNothingToAdd={() => onAsking(false)}
      />
      <StoryList
        entry={entry}
        entries={entries}
        today={today}
        onOpen={onOpen}
      />
      {entry.parentEntryId === null ? (
        <ThreadsSection
          threads={threads}
          on={entry.threadIds}
          onOpen={onOpenThread}
          onTakeOff={(thread) =>
            run({ type: "take entry off thread", threadId: thread.threadId })
          }
          onPutOn={putOnThread}
        />
      ) : (
        <UpdateThreads
          on={entry.threadIds.flatMap(
            (threadId) => threads.find((t) => t.threadId === threadId) ?? [],
          )}
          onOpen={onOpenThread}
        />
      )}
      <FieldError>{failure}</FieldError>
      <Separator />
      <div className="flex gap-2">
        {entry.putAway ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => run({ type: "bring entry back" })}
          >
            Bring back
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => run({ type: "put entry away" })}
          >
            Put away
          </Button>
        )}
        <AlertDialog>
          <AlertDialogTrigger
            render={<Button variant="destructive" size="sm" />}
          >
            Delete
          </AlertDialogTrigger>
          <AlertDialogContent size="sm">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this entry?</AlertDialogTitle>
              <AlertDialogDescription>
                Its updates stay, attached to what it followed from.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={async () => {
                  if (await run({ type: "delete entry" })) onClose();
                }}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </SidePanel>
  );
}

function ThreadsSection({
  threads,
  on,
  onOpen,
  onTakeOff,
  onPutOn,
}: {
  threads: readonly ThreadListItem[];
  on: readonly ThreadId[];
  onOpen: (thread: ThreadListItem) => void;
  onTakeOff: (thread: ThreadListItem) => void;
  onPutOn: (choice: ThreadChoice) => void;
}) {
  const onThreads = on.flatMap(
    (threadId) => threads.find((thread) => thread.threadId === threadId) ?? [],
  );
  return (
    <section aria-labelledby="entry-threads" className="flex flex-col gap-2">
      <h3
        id="entry-threads"
        className="text-xs font-medium tracking-wider text-muted-foreground uppercase"
      >
        Threads
      </h3>
      {onThreads.length === 0 ? (
        <p className="text-sm text-muted-foreground">Loose. That's fine.</p>
      ) : (
        <ul className="flex flex-col">
          {onThreads.map((thread) => (
            <li
              key={thread.threadId}
              className="flex items-center justify-between gap-2 border-b py-1.5"
            >
              <ThreadChip thread={thread} onOpen={onOpen} />
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={`Take off "${thread.name}"`}
                onClick={() => onTakeOff(thread)}
              >
                <XIcon />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <ThreadPicker threads={threads} on={on} onChoose={onPutOn} />
    </section>
  );
}

function UpdateThreads({
  on,
  onOpen,
}: {
  on: readonly ThreadListItem[];
  onOpen: (thread: ThreadListItem) => void;
}) {
  return (
    <section aria-labelledby="entry-threads" className="flex flex-col gap-2">
      <h3
        id="entry-threads"
        className="text-xs font-medium tracking-wider text-muted-foreground uppercase"
      >
        Threads
      </h3>
      <p className="text-sm text-muted-foreground">
        {on.length === 0
          ? "Loose, like the entry it started from."
          : "An update is on the threads of the entry it started from."}
      </p>
      {on.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {on.map((thread) => (
            <ThreadChip key={thread.threadId} thread={thread} onOpen={onOpen} />
          ))}
        </div>
      )}
    </section>
  );
}

/** "Entry · Nov 8", "Update · Nov 8 · put away". */
export function panelTitle(entry: EntryListItem): string {
  return [
    entry.parentEntryId === null ? "Entry" : "Update",
    writtenOn(entry.writtenAt),
    ...(entry.putAway ? ["put away"] : []),
  ].join(" · ");
}

/**
 * The bodies a panel has sent and not yet read back, oldest first, so a save's answer never
 * replaces what was typed after it, and the same body is sent once.
 */
export function bodySaves() {
  let pending: string[] = [];
  return {
    /** Whether `next` needs sending, `body` being the one last read. */
    send(next: string, body: string): boolean {
      if (next === (pending.at(-1) ?? body)) return false;
      pending.push(next);
      return true;
    },
    failed(next: string) {
      pending = pending.filter((each) => each !== next);
    },
    /** Whether the field should show `body`, just read, in place of `draft`. */
    read(body: string, draft: string): boolean {
      const answered = pending.indexOf(body);
      if (answered === -1) {
        pending = [];
        return true;
      }
      pending = pending.slice(answered + 1);
      return pending.length === 0 && draft.trim() === body;
    },
  };
}

/**
 * The body is saved when the field loses focus, and when the panel closes or moves to another
 * Entry with an edit not yet saved. An emptied body is not saved and comes back.
 */
function BodyField({
  entry,
  onSave,
}: {
  entry: EntryListItem;
  onSave: (body: string) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState(entry.body);
  const latest = useRef({ draft, body: entry.body, onSave });
  latest.current = { draft, body: entry.body, onSave };
  const saves = useRef(bodySaves());

  useEffect(() => {
    if (saves.current.read(entry.body, latest.current.draft)) {
      setDraft(entry.body);
    }
  }, [entry.body]);
  useEffect(() => () => save(), []);

  function save() {
    const { draft, body, onSave } = latest.current;
    const next = draft.trim();
    if (next === "") {
      setDraft(body);
      return;
    }
    if (!saves.current.send(next, body)) return;
    void onSave(next).then((saved) => {
      if (!saved) saves.current.failed(next);
    });
  }

  return (
    <Textarea
      aria-label="Body"
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={save}
      className="min-h-20 resize-none text-base md:text-base"
    />
  );
}

function FollowUpDateRow({
  entry,
  today,
  onSet,
  onClear,
  onComplete,
}: {
  entry: EntryListItem;
  today: CalendarDay;
  onSet: (followUpDate: FollowUpDate) => Promise<boolean>;
  onClear: () => Promise<boolean>;
  onComplete: () => void;
}) {
  const date = entry.followUpDate;
  const { completed } = entry;
  const [repeat, setRepeat] = useRepeatDraft(date);

  function changeDay(day: CalendarDay | "") {
    if (day === "") void onClear();
    else if (date) void onSet({ ...date, day });
    else void onSet({ day, time: null, repeat: null });
  }

  function changeRepeat(next: RepeatDraft) {
    setRepeat(next);
    const chosen = repeatOf(next);
    if (date && chosen !== "incomplete")
      void onSet({ ...date, repeat: chosen });
  }

  return (
    <div className="flex flex-col gap-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        {date && <span className="text-muted-foreground">Comes back</span>}
        <DayField
          value={date?.day ?? ""}
          onChange={changeDay}
          today={today}
          trigger={
            <Button type="button" variant={date ? "secondary" : "ghost"}>
              <CalendarIcon />
              {date
                ? followUpLabel({ ...date, time: null }, today)
                : "Bring back…"}
            </Button>
          }
        />
        {date && (
          <>
            <TimeField
              value={date.time ?? ""}
              onChange={(time) =>
                void onSet({ ...date, time: time ? timeOfDay(time) : null })
              }
            />
            <RepeatField
              value={repeat}
              onKind={(kind) =>
                changeRepeat(
                  startRepeat(kind, {
                    weekday: weekdayOf(date.day),
                    date: Number(date.day.slice(8)),
                  }),
                )
              }
              onChange={changeRepeat}
            />
          </>
        )}
      </div>
      {date && (
        <div className="flex gap-2">
          <Button size="sm" onClick={onComplete}>
            <CheckIcon />
            Complete
          </Button>
          <Button variant="ghost" size="sm" onClick={() => void onClear()}>
            No date
          </Button>
        </div>
      )}
      {completed && (
        <p className="flex flex-wrap items-center gap-2 text-muted-foreground">
          <span>
            Completed {writtenOn(completed.at)}
            {date === null && ", kept as a record"}
          </span>
          <Button
            variant="outline"
            size="xs"
            onClick={() => void onSet(completed.followUpDate)}
          >
            Undo
          </Button>
        </p>
      )}
    </div>
  );
}

/**
 * The Repeat as it is being chosen. It follows the Entry's Repeat, except while a choice is
 * incomplete (a weekly Repeat with no weekday yet), which only this field knows about.
 */
function useRepeatDraft(date: FollowUpDate | null) {
  const stored = JSON.stringify(date?.repeat ?? null);
  const [draft, setDraft] = useState(() => draftOf(date?.repeat ?? null));
  useEffect(() => setDraft(draftOf(date?.repeat ?? null)), [stored]);
  return [draft, setDraft] as const;
}

function failureMessage(error: unknown): string {
  return error instanceof WeftError
    ? `Weft refused this change: ${error.message}`
    : `Weft couldn't save this change: ${messageOf(error)}`;
}
