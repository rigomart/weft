import type {
  CalendarDay,
  EntryId,
  EntryListItem,
  ThreadListItem,
} from "@weft/contracts";
import { cn } from "cn";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./components/ui/tooltip.tsx";
import { followUpLabel } from "./follow-up-date.ts";
import {
  historyLayout,
  LANE_HEIGHT,
  LOOSE_HEIGHT,
  TOP,
  type HistoryDot,
  type HistoryLayout,
} from "./history.ts";
import { threadHue } from "./thread-chip.tsx";
import { writtenOn } from "./weft-state.ts";

/**
 * History: each open Thread as a lane through time, and Loose Entries in a band below. It opens
 * scrolled to just before today. Hovering a dot shows its Entry; clicking opens it, and clicking a
 * lane's name opens its Thread.
 */
export function HistoryView({
  entries,
  threads,
  today,
  openId,
  onOpen,
  onOpenThread,
}: {
  entries: readonly EntryListItem[];
  threads: readonly ThreadListItem[];
  today: CalendarDay;
  openId: string | null;
  onOpen: (entryId: EntryId) => void;
  onOpenThread: (thread: ThreadListItem) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const now = useNow();
  const layout = useMemo(
    () => historyLayout({ entries, threads, today, now, width }),
    [entries, threads, today, now, width],
  );

  useLayoutEffect(() => {
    const element = scroller.current;
    if (!element) return;
    const widenOnly = () =>
      setWidth((current) => Math.max(current, element.clientWidth));
    widenOnly();
    const observer = new ResizeObserver(widenOnly);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const scrolledAway = useRef(false);
  const scrolledTo = useRef<number | null>(null);
  useLayoutEffect(() => {
    const element = scroller.current;
    if (!element || width === 0 || scrolledAway.current) return;
    element.scrollLeft = Math.max(0, layout.today - element.clientWidth * 0.68);
    scrolledTo.current = element.scrollLeft;
  }, [layout, width]);

  const latest = useRef(layout);
  latest.current = layout;
  useLayoutEffect(() => {
    const element = scroller.current;
    const dot = latest.current.dots.find(
      (each) => each.entry.entryId === openId,
    );
    if (!element || !dot) return;
    const left = element.scrollLeft;
    if (dot.x < left + 24 || dot.x > left + element.clientWidth - 24) {
      element.scrollLeft = dot.x - element.clientWidth / 2;
      scrolledAway.current = true;
    }
  }, [openId]);

  const threadById = new Map(
    threads.map((thread) => [thread.threadId, thread]),
  );

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-3 px-8 pt-6 pb-16">
        <div className="flex overflow-hidden rounded-xl border bg-card">
          <div
            className="relative w-[10.5rem] shrink-0 border-e"
            style={{ height: layout.height }}
          >
            {layout.lanes.map((lane) => (
              <button
                key={lane.thread.threadId}
                type="button"
                data-thread={lane.thread.threadId}
                style={
                  {
                    "--thread-hue": threadHue(lane.thread.threadId),
                    top: lane.y - LANE_HEIGHT / 2,
                    height: LANE_HEIGHT,
                  } as CSSProperties
                }
                aria-label={`Open thread "${lane.thread.name}"`}
                aria-current={openId === lane.thread.threadId || undefined}
                className="absolute inset-x-0 flex cursor-pointer flex-col justify-center gap-0.5 px-3 text-start outline-none hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset aria-[current]:bg-muted"
                onClick={() => onOpenThread(lane.thread)}
              >
                <span className="flex items-center gap-1.5 font-semibold">
                  <span
                    aria-hidden="true"
                    className="size-2 shrink-0 rounded-full bg-(--thread)"
                  />
                  <span className="truncate">{lane.thread.name}</span>
                </span>
                <span className="text-xs text-muted-foreground">
                  {lane.entries} {lane.entries === 1 ? "entry" : "entries"}
                  {lane.asking > 0 && ` · ${lane.asking} asking`}
                </span>
              </button>
            ))}
            <div
              className="absolute inset-x-0 flex flex-col justify-center gap-0.5 border-t px-3"
              style={{ top: layout.looseTop, height: LOOSE_HEIGHT }}
            >
              <span className="font-semibold">Loose</span>
              <span className="text-xs text-muted-foreground">
                {layout.loose} on no thread
              </span>
            </div>
          </div>
          <div
            ref={scroller}
            role="region"
            aria-label="Timeline"
            onScroll={(event) => {
              const to = scrolledTo.current;
              if (
                to === null ||
                Math.abs(event.currentTarget.scrollLeft - to) > 1
              ) {
                scrolledAway.current = true;
              }
            }}
            className="relative min-w-0 flex-1 overflow-x-auto overflow-y-hidden [scrollbar-color:var(--color-border)_transparent] [scrollbar-width:thin]"
          >
            <div
              className="relative"
              style={{ width: layout.width, height: layout.height }}
            >
              <Lines layout={layout} />
              {layout.dots.map((dot) => (
                <Dot
                  key={dot.entry.entryId}
                  dot={dot}
                  threads={dot.threadIds.flatMap(
                    (id) => threadById.get(id) ?? [],
                  )}
                  today={today}
                  open={openId === dot.entry.entryId}
                  onOpen={onOpen}
                />
              ))}
            </div>
          </div>
        </div>
        <Legend />
      </div>
    </TooltipProvider>
  );
}

function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const timer = setInterval(tick, 60_000);
    window.addEventListener("focus", tick);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", tick);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);
  return now;
}

function Lines({ layout }: { layout: HistoryLayout }) {
  const { width, height, looseTop } = layout;
  return (
    <svg
      aria-hidden="true"
      width={width}
      height={height}
      className="absolute inset-0 overflow-visible"
    >
      {layout.lanes.map(
        (lane, i) =>
          i % 2 === 0 && (
            <rect
              key={lane.thread.threadId}
              x={0}
              y={lane.y - LANE_HEIGHT / 2}
              width={width}
              height={LANE_HEIGHT}
              className="fill-muted/45"
            />
          ),
      )}
      {layout.months.map((month) => (
        <g key={month.x}>
          <line
            x1={month.x}
            x2={month.x}
            y1={TOP - 10}
            y2={height}
            className="stroke-border"
          />
          <text
            x={month.x + 5}
            y={TOP - 14}
            className="fill-muted-foreground text-[11px]"
          >
            {month.label}
          </text>
        </g>
      ))}
      <line
        x1={0}
        x2={width}
        y1={looseTop}
        y2={looseTop}
        className="stroke-border"
      />
      {layout.lanes.map((lane) => (
        <g
          key={lane.thread.threadId}
          data-thread={lane.thread.threadId}
          style={
            { "--thread-hue": threadHue(lane.thread.threadId) } as CSSProperties
          }
          className="fill-none stroke-(--thread) [stroke-linecap:round]"
        >
          <line
            x1={lane.from}
            x2={lane.to}
            y1={lane.y}
            y2={lane.y}
            strokeWidth={3}
          />
          {lane.until !== null && (
            <line
              x1={lane.to}
              x2={lane.until}
              y1={lane.y}
              y2={lane.y}
              strokeWidth={2.5}
              strokeDasharray="2 6"
            />
          )}
        </g>
      ))}
      <line
        x1={layout.today}
        x2={layout.today}
        y1={TOP - 26}
        y2={height}
        strokeDasharray="2 3"
        className="stroke-foreground"
      />
      <text
        x={layout.today + 5}
        y={TOP - 24}
        className="fill-foreground text-[11px] font-semibold"
      >
        today
      </text>
      {layout.joins.map((join) => {
        const { from, to } = join;
        const lift = Math.min(30, 10 + Math.abs(to.x - from.x) / 8);
        return (
          <path
            key={`${from.x},${from.y},${to.x},${to.y}`}
            d={`M${from.x},${from.y} Q${(from.x + to.x) / 2},${Math.min(from.y, to.y) - lift} ${to.x},${to.y}`}
            strokeWidth={1.5}
            className="fill-none stroke-muted-foreground opacity-75"
          />
        );
      })}
    </svg>
  );
}

function Dot({
  dot,
  threads,
  today,
  open,
  onOpen,
}: {
  dot: HistoryDot;
  threads: readonly ThreadListItem[];
  today: CalendarDay;
  open: boolean;
  onOpen: (entryId: EntryId) => void;
}) {
  const { entry, x, ys, asking, late } = dot;
  const loose = threads.length === 0;
  const top = ys[0]!;
  const bottom = ys[ys.length - 1]!;
  const spans = ys.length > 1;
  const r = spans ? 5 : 6;
  const date = entry.followUpDate;
  const when = date
    ? `${late ? "Late · " : "Comes back "}${followUpLabel(date, today)}`
    : writtenOn(entry.completed?.at ?? entry.writtenAt);
  const tone = late
    ? "border-[2.5px] border-late bg-late-tint"
    : loose
      ? asking
        ? "border-2 border-muted-foreground bg-card"
        : "bg-muted-foreground"
      : asking
        ? "border-[2.5px] border-(--thread) bg-card"
        : "border-2 border-card bg-(--thread)";
  const where = loose
    ? "Loose"
    : threads.map((thread) => thread.name).join(", ");
  return (
    <>
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              aria-label={`Open "${entry.body}"`}
              aria-current={open || undefined}
              data-entry={entry.entryId}
              onClick={() => onOpen(entry.entryId)}
              style={{
                left: x - (spans ? 8 : r),
                top: top - (spans ? 9 : r),
                width: spans ? 16 : r * 2,
                height: spans ? bottom - top + 18 : r * 2,
              }}
              className={cn(
                "absolute cursor-pointer rounded-full outline-none before:absolute before:-inset-1 focus-visible:ring-3 focus-visible:ring-ring/50 aria-[current]:outline-2 aria-[current]:outline-solid aria-[current]:outline-offset-3 aria-[current]:outline-foreground",
                spans && "border-[1.5px] border-muted-foreground bg-card",
              )}
            />
          }
        >
          {ys.map((y, i) => (
            <span
              key={y}
              aria-hidden="true"
              data-thread={threads[i]?.threadId}
              style={
                {
                  "--thread-hue": threads[i]
                    ? threadHue(threads[i].threadId)
                    : undefined,
                  left: (spans ? 8 : r) - r - (spans ? 1.5 : 0),
                  top: y - top + (spans ? 9 : r) - r - (spans ? 1.5 : 0),
                  width: r * 2,
                  height: r * 2,
                } as CSSProperties
              }
              className={cn("absolute rounded-full", tone)}
            />
          ))}
        </TooltipTrigger>
        <TooltipContent passThrough className="flex-col items-start gap-0.5">
          <span>{entry.body}</span>
          <span className="opacity-70">
            {dot.rhythm ? `↻ ${dot.rhythm} · ` : ""}
            {when} · {where}
            {entry.parentEntryId !== null && " · follows from an earlier entry"}
          </span>
        </TooltipContent>
      </Tooltip>
      {dot.label && (
        <span
          aria-hidden="true"
          style={{ left: x - 4, top: dot.label.y - 11 }}
          className={cn(
            "pointer-events-none absolute text-[11px] leading-[14px] whitespace-nowrap text-muted-foreground",
            asking && "font-medium text-foreground",
          )}
        >
          {dot.label.text}
        </span>
      )}
    </>
  );
}

function Legend() {
  const mark = "inline-block size-2.5 rounded-full";
  return (
    <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1.5">
        <i className={cn(mark, "bg-muted-foreground")} />
        something that happened
      </span>
      <span className="inline-flex items-center gap-1.5">
        <i className={cn(mark, "border-2 border-muted-foreground")} />
        comes back
      </span>
      <span className="inline-flex items-center gap-1.5">
        <i className={cn(mark, "border-2 border-late bg-late-tint")} />
        late
      </span>
      <span>⌒ what happened next</span>
      <span className="inline-flex items-center gap-1.5">
        <i className="inline-block h-4 w-2.5 rounded-full border-[1.5px] border-muted-foreground" />
        on several threads
      </span>
      <span>↻ repeats</span>
    </p>
  );
}
