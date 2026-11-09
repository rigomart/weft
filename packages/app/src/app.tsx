import type { EntryId, ThreadId, ThreadListItem, Weft } from "@weft/contracts";
import { useState } from "react";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "./components/ui/tabs.tsx";
import { EntryPanel } from "./entry-panel.tsx";
import { NowView, useCaptureBox } from "./now.tsx";
import { ThreadPanel } from "./thread-panel.tsx";
import { useEntries, useThreads, useToday } from "./weft-state.ts";

/** The three views, by their working names in GLOSSARY.md. */
export const views = [
  { value: "now", label: "Now" },
  { value: "workspace", label: "Workspace" },
  { value: "history", label: "History" },
] as const;

type Open =
  | { readonly kind: "entry"; readonly entryId: EntryId }
  | { readonly kind: "thread"; readonly threadId: ThreadId };

export function App({ weft }: { weft: Weft }) {
  const captureBox = useCaptureBox(weft);
  const { entries, failure } = useEntries(weft);
  const { threads, failure: threadsFailure } = useThreads(weft);
  const today = useToday();
  const [open, setOpen] = useState<Open | null>(null);
  const openEntry =
    open?.kind === "entry"
      ? entries.find((entry) => entry.entryId === open.entryId)
      : undefined;
  const openThread =
    open?.kind === "thread"
      ? threads.find((thread) => thread.threadId === open.threadId)
      : undefined;
  const onOpenThread = (thread: ThreadListItem) =>
    setOpen({ kind: "thread", threadId: thread.threadId });

  return (
    <div className="flex min-h-svh">
      <Tabs defaultValue="now" className="@container min-w-0 flex-1 gap-0">
        <header className="flex items-center gap-6 px-8 pt-4">
          <span className="text-sm font-semibold">Weft</span>
          <TabsList variant="line">
            {views.map((view) => (
              <TabsTrigger key={view.value} value={view.value}>
                {view.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </header>
        <TabsContent value="now">
          <NowView
            weft={weft}
            captureBox={captureBox}
            entries={entries}
            threads={threads}
            listFailure={failure ?? threadsFailure}
            today={today}
            openId={openEntry?.entryId ?? openThread?.threadId ?? null}
            onOpen={(entryId) => setOpen({ kind: "entry", entryId })}
            onOpenThread={onOpenThread}
          />
        </TabsContent>
        <TabsContent value="workspace" />
        <TabsContent value="history" />
      </Tabs>
      {openEntry && (
        <EntryPanel
          key={openEntry.entryId}
          weft={weft}
          entry={openEntry}
          threads={threads}
          today={today}
          onClose={() => setOpen(null)}
          onOpenThread={onOpenThread}
        />
      )}
      {openThread && (
        <ThreadPanel
          key={openThread.threadId}
          weft={weft}
          thread={openThread}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}
