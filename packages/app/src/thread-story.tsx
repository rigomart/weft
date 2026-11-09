import type {
  CalendarDay,
  EntryId,
  EntryListItem,
  ThreadId,
  ThreadListItem,
} from "@weft/contracts";
import { cn } from "cn";
import { useMemo } from "react";

import { daysFrom, followUpLabel } from "./follow-up-date.ts";
import { threadStory } from "./story.ts";
import { ThreadChip } from "./thread-chip.tsx";
import { writtenOn } from "./weft-state.ts";

/**
 * Every Entry and Update on the Thread in time order, with a Today divider between what happened
 * and what is coming. Clicking a line opens its Entry.
 */
export function ThreadStoryList({
  threadId,
  entries,
  threads,
  today,
  onOpen,
  onOpenThread,
}: {
  threadId: ThreadId;
  entries: readonly EntryListItem[];
  threads: readonly ThreadListItem[];
  today: CalendarDay;
  onOpen: (entryId: EntryId) => void;
  onOpenThread: (thread: ThreadListItem) => void;
}) {
  const { happened, coming } = useMemo(
    () => threadStory(threadId, entries, today),
    [threadId, entries, today],
  );
  const count = happened.length + coming.length;
  const line = (entry: EntryListItem) => (
    <StoryLine
      key={entry.entryId}
      entry={entry}
      also={
        entry.parentEntryId === null
          ? entry.threadIds.flatMap((id) =>
              id === threadId
                ? []
                : (threads.find((thread) => thread.threadId === id) ?? []),
            )
          : []
      }
      today={today}
      onOpen={onOpen}
      onOpenThread={onOpenThread}
    />
  );
  return (
    <section aria-labelledby="thread-story" className="flex flex-col">
      <h3
        id="thread-story"
        className="text-xs font-medium tracking-wider text-muted-foreground uppercase"
      >
        Story · {count}
      </h3>
      <p className="mt-1 mb-3 text-xs text-muted-foreground">
        {count === 0
          ? "Nothing is on this thread yet."
          : "↳ marks what happened next."}
      </p>
      <ol className="flex flex-col">
        {happened.map(line)}
        <li
          role="separator"
          className="border-t-[1.5px] border-foreground pt-2.5 pb-1 text-[11px] font-medium tracking-widest uppercase"
        >
          Today
        </li>
        {coming.map(line)}
      </ol>
    </section>
  );
}

function StoryLine({
  entry,
  also,
  today,
  onOpen,
  onOpenThread,
}: {
  entry: EntryListItem;
  also: readonly ThreadListItem[];
  today: CalendarDay;
  onOpen: (entryId: EntryId) => void;
  onOpenThread: (thread: ThreadListItem) => void;
}) {
  const date = entry.followUpDate;
  const late = date !== null && daysFrom(today, date.day) < 0;
  return (
    <li
      className={cn(
        "relative grid grid-cols-[3.5rem_minmax(0,1fr)] gap-2.5 border-t py-2 hover:bg-muted/50",
        entry.putAway && "opacity-50",
      )}
    >
      <button
        type="button"
        aria-label={`Open "${entry.body}"`}
        className="absolute inset-0 cursor-pointer outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        onClick={() => onOpen(entry.entryId)}
      />
      <span
        className={cn(
          "pt-px text-xs text-muted-foreground",
          late && "text-late",
        )}
      >
        {date
          ? followUpLabel(date, today)
          : writtenOn(entry.completed?.at ?? entry.writtenAt)}
      </span>
      <span className="flex flex-col gap-1 text-sm">
        <span className={cn(entry.parentEntryId !== null && "ps-4")}>
          {entry.parentEntryId !== null && (
            <span
              aria-hidden="true"
              className="-ms-4 inline-block w-4 text-muted-foreground"
            >
              ↳
            </span>
          )}
          {date ? (
            <span
              aria-hidden="true"
              className={cn("text-muted-foreground", late && "text-late")}
            >
              ○{" "}
            </span>
          ) : entry.completed ? (
            <span aria-hidden="true" className="text-muted-foreground">
              ✓{" "}
            </span>
          ) : null}
          {entry.body}
          {late && <span className="sr-only">, late</span>}
          {entry.putAway && (
            <span className="text-xs text-muted-foreground"> · put away</span>
          )}
        </span>
        {also.length > 0 && (
          <span className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
            also on
            {also.map((thread) => (
              <ThreadChip
                key={thread.threadId}
                thread={thread}
                onOpen={onOpenThread}
              />
            ))}
          </span>
        )}
      </span>
    </li>
  );
}
