import { WeftError, type EntryListItem, type Weft } from "@weft/contracts";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import { createCapture } from "./capture.ts";
import { Button } from "./components/ui/button.tsx";
import { Field, FieldError } from "./components/ui/field.tsx";
import { Input } from "./components/ui/input.tsx";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
} from "./components/ui/item.tsx";

/**
 * What the capture box holds: its text, the last failure, and the command waiting to be retried.
 * The app keeps it above the tabs, so changing tabs loses none of it.
 */
export function useCaptureBox(weft: Weft) {
  const capture = useMemo(() => createCapture(weft), [weft]);
  const [text, setText] = useState("");
  const [failure, setFailure] = useState<string>();

  /** Resolves to true once the Entry is written. */
  async function submit(): Promise<boolean> {
    const submitted = text;
    try {
      if (!(await capture(submitted))) return false;
      setFailure(undefined);
      setText((current) => (current === submitted ? "" : current));
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

  return { text, setText, failure, submit };
}

export type CaptureBox = ReturnType<typeof useCaptureBox>;

/** The capture box and every Entry, newest first. The real glance view comes later (#6). */
export function NowView({
  weft,
  captureBox: { text, setText, failure, submit },
}: {
  weft: Weft;
  captureBox: CaptureBox;
}) {
  const { entries, failure: listFailure } = useEntries(weft);
  const box = useRef<HTMLInputElement>(null);

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
        <FieldError>{failure}</FieldError>
      </form>
      <FieldError>{listFailure}</FieldError>
      <ItemGroup aria-label="Entries">
        {entries.map((entry) => (
          <Item key={entry.entryId} role="listitem" size="sm">
            <ItemContent>{entry.body}</ItemContent>
            <ItemActions>
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

/** Every Entry, read again each time Weft says the entries changed. */
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
