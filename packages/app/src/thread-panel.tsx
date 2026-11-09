import { WeftError, type ThreadListItem, type Weft } from "@weft/contracts";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";

import { Button } from "./components/ui/button.tsx";
import { FieldError } from "./components/ui/field.tsx";
import { Input } from "./components/ui/input.tsx";
import { newId } from "./new-id.ts";
import { SidePanel } from "./side-panel.tsx";
import { threadHue } from "./thread-chip.tsx";
import { messageOf, writtenOn } from "./weft-state.ts";

type ThreadCommand =
  | { readonly type: "rename thread"; readonly name: string }
  | { readonly type: "resolve thread" }
  | { readonly type: "reopen thread" };

export function ThreadPanel({
  weft,
  thread,
  onClose,
  children,
}: {
  weft: Weft;
  thread: ThreadListItem;
  onClose: () => void;
  children?: ReactNode;
}) {
  const [failure, setFailure] = useState<string>();

  async function run(command: ThreadCommand) {
    try {
      await weft.run({
        ...command,
        eventId: newId("event"),
        threadId: thread.threadId,
      });
      setFailure(undefined);
    } catch (error) {
      setFailure(
        error instanceof WeftError
          ? `Weft refused this change: ${error.message}`
          : `Weft couldn't save this change: ${messageOf(error)}`,
      );
    }
  }

  return (
    <SidePanel
      title={
        <>
          <span
            aria-hidden="true"
            className="size-2 rounded-full bg-(--thread)"
          />
          Thread
        </>
      }
      label={`Thread ${thread.name}`}
      data-thread={thread.threadId}
      style={{ "--thread-hue": threadHue(thread.threadId) } as CSSProperties}
      onClose={onClose}
    >
      <NameField
        name={thread.name}
        onRename={(name) => run({ type: "rename thread", name })}
      />
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {thread.resolvedAt === null ? (
          <>
            <span>Open</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => run({ type: "resolve thread" })}
            >
              Resolve
            </Button>
          </>
        ) : (
          <>
            <span>Resolved {writtenOn(thread.resolvedAt)}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => run({ type: "reopen thread" })}
            >
              Reopen
            </Button>
          </>
        )}
      </div>
      <FieldError>{failure}</FieldError>
      {children}
    </SidePanel>
  );
}

function NameField({
  name,
  onRename,
}: {
  name: string;
  onRename: (name: string) => void;
}) {
  const [draft, setDraft] = useState(name);
  useEffect(() => setDraft(name), [name]);

  function commit() {
    const next = draft.trim().replace(/\s+/g, " ");
    if (next === "") setDraft(name);
    else if (next !== name) onRename(next);
  }

  return (
    <Input
      aria-label="Thread name"
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
      }}
      className="h-10 text-lg font-semibold md:text-lg"
    />
  );
}
