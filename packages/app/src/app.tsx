import type { Weft } from "@weft/contracts";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "./components/ui/tabs.tsx";
import { NowView } from "./now.tsx";

/** The three views, by their working names in GLOSSARY.md. */
export const views = [
  { value: "now", label: "Now" },
  { value: "workspace", label: "Workspace" },
  { value: "history", label: "History" },
] as const;

export function App({ weft }: { weft: Weft }) {
  return (
    <Tabs defaultValue="now" className="min-h-svh">
      <header className="border-b p-2">
        <TabsList>
          {views.map((view) => (
            <TabsTrigger key={view.value} value={view.value}>
              {view.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </header>
      <TabsContent value="now">
        <NowView weft={weft} />
      </TabsContent>
      <TabsContent value="workspace" />
      <TabsContent value="history" />
    </Tabs>
  );
}
