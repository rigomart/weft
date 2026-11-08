import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "./components/ui/tabs.tsx";

/** The three views, by their working names in GLOSSARY.md. Each is empty until its own slice. */
export const views = [
  { value: "now", label: "Now" },
  { value: "workspace", label: "Workspace" },
  { value: "history", label: "History" },
] as const;

export function App() {
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
      {views.map((view) => (
        <TabsContent key={view.value} value={view.value} />
      ))}
    </Tabs>
  );
}
