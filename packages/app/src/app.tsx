import type { EntryId, Weft } from "@weft/contracts";
import { useState } from "react";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "./components/ui/tabs.tsx";
import { EntryPanel } from "./entry-panel.tsx";
import { NowView, useCaptureBox } from "./now.tsx";
import { useEntries, useToday } from "./weft-state.ts";

/** The three views, by their working names in GLOSSARY.md. */
export const views = [
  { value: "now", label: "Now" },
  { value: "workspace", label: "Workspace" },
  { value: "history", label: "History" },
] as const;

export function App({ weft }: { weft: Weft }) {
  const captureBox = useCaptureBox(weft);
  const { entries, failure } = useEntries(weft);
  const today = useToday();
  const [openEntryId, setOpenEntryId] = useState<EntryId | null>(null);
  const openEntry = entries.find((entry) => entry.entryId === openEntryId);

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
            listFailure={failure}
            today={today}
            openEntryId={openEntry ? openEntry.entryId : null}
            onOpen={setOpenEntryId}
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
          today={today}
          onClose={() => setOpenEntryId(null)}
        />
      )}
    </div>
  );
}
