import type { ThreadId, ThreadListItem } from "@weft/contracts";
import { cn } from "cn";
import type { CSSProperties, ReactNode } from "react";

/** A Thread's hue, the same on every device and every launch. */
export function threadHue(threadId: ThreadId): number {
  let hash = 0;
  for (const char of threadId) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash % 360;
}

/** A button when `onOpen` is given, otherwise plain text. */
export function ThreadChip({
  thread,
  onOpen,
  className,
}: {
  thread: ThreadListItem;
  onOpen?: (thread: ThreadListItem) => void;
  className?: string;
}) {
  const resolved = thread.resolvedAt !== null;
  const content = (
    <>
      <span
        aria-hidden="true"
        className="size-1.5 shrink-0 rounded-full bg-(--thread)"
      />
      <span className="truncate">{thread.name}</span>
      {resolved && <span className="text-muted-foreground">resolved</span>}
    </>
  );
  const props = {
    style: { "--thread-hue": threadHue(thread.threadId) } as CSSProperties,
    className: cn(
      "inline-flex max-w-full items-center gap-1.5 rounded-full bg-(--thread-tint) px-2 py-0.5 text-xs leading-none text-(--thread-ink)",
      resolved && "opacity-70",
      className,
    ),
    "data-thread": thread.threadId,
  };
  if (!onOpen) return <span {...props}>{content}</span>;
  return (
    <button
      type="button"
      {...props}
      aria-label={`Open thread "${thread.name}"${resolved ? ", resolved" : ""}`}
      className={cn(
        props.className,
        "relative cursor-pointer outline-none hover:brightness-95 focus-visible:ring-3 focus-visible:ring-ring/50 dark:hover:brightness-125",
      )}
      onClick={(event) => {
        event.stopPropagation();
        onOpen(thread);
      }}
    >
      {content}
    </button>
  );
}

export function LooseChip(): ReactNode {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-xs leading-none text-muted-foreground">
      <span
        aria-hidden="true"
        className="size-1.5 rounded-full bg-muted-foreground"
      />
      Loose
    </span>
  );
}
