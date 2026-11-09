import type { ThreadId, ThreadListItem } from "@weft/contracts";
import { PlusIcon } from "lucide-react";
import { useMemo, useState } from "react";

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "./components/ui/combobox.tsx";
import { ThreadChip } from "./thread-chip.tsx";

export type ThreadChoice =
  | { readonly kind: "thread"; readonly thread: ThreadListItem }
  | { readonly kind: "new"; readonly name: string };

/**
 * The Threads offered for `typed`: those the Entry is not on whose name contains it, open ones
 * first, then starting a new Thread with that name unless a Thread already has it exactly.
 */
export function threadChoices(
  threads: readonly ThreadListItem[],
  on: readonly ThreadId[],
  typed: string,
): ThreadChoice[] {
  const name = typed.trim().replace(/\s+/g, " ");
  const query = name.toLowerCase();
  const matching = threads
    .filter(
      (thread) =>
        !on.includes(thread.threadId) &&
        thread.name.toLowerCase().includes(query),
    )
    .sort(
      (a, b) => Number(a.resolvedAt !== null) - Number(b.resolvedAt !== null),
    )
    .map((thread): ThreadChoice => ({ kind: "thread", thread }));
  const taken = threads.some((thread) => thread.name.toLowerCase() === query);
  return name === "" || taken ? matching : [...matching, { kind: "new", name }];
}

export function ThreadPicker({
  threads,
  on,
  onChoose,
}: {
  threads: readonly ThreadListItem[];
  /** The Threads the Entry is on. */
  on: readonly ThreadId[];
  onChoose: (choice: ThreadChoice) => void;
}) {
  const [typed, setTyped] = useState("");
  const items = useMemo(
    () => threadChoices(threads, on, typed),
    [threads, on, typed],
  );
  return (
    <Combobox
      items={items}
      filter={null}
      value={null}
      inputValue={typed}
      onInputValueChange={setTyped}
      onValueChange={(choice) => {
        if (!choice) return;
        onChoose(choice as ThreadChoice);
        setTyped("");
      }}
      itemToStringLabel={(choice: ThreadChoice) =>
        choice.kind === "thread" ? choice.thread.name : choice.name
      }
      autoHighlight
    >
      <ComboboxInput
        aria-label="Put on a thread"
        placeholder="Put on a thread…"
        className="w-full"
      />
      <ComboboxContent>
        <ComboboxEmpty>Type a name to start a thread</ComboboxEmpty>
        <ComboboxList>
          {(choice: ThreadChoice) =>
            choice.kind === "thread" ? (
              <ComboboxItem key={choice.thread.threadId} value={choice}>
                <ThreadChip thread={choice.thread} />
              </ComboboxItem>
            ) : (
              <ComboboxItem key="new" value={choice}>
                <PlusIcon />
                Start “{choice.name}”
              </ComboboxItem>
            )
          }
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
