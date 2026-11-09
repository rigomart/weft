import type { Weft } from "@weft/contracts";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "./components/ui/tabs.tsx";
import { NowView, useCaptureBox } from "./now.tsx";

/** The three views, by their working names in GLOSSARY.md. */
export const views = [
  { value: "now", label: "Now" },
  { value: "workspace", label: "Workspace" },
  { value: "history", label: "History" },
] as const;

export function App({ weft }: { weft: Weft }) {
  const captureBox = useCaptureBox(weft);
  return (
    <Tabs defaultValue="now" className="min-h-svh gap-0">
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
        <NowView weft={weft} captureBox={captureBox} />
      </TabsContent>
      <TabsContent value="workspace" />
      <TabsContent value="history" />
    </Tabs>
  );
}
