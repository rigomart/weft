import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { App } from "./app.tsx";

test("the header has the three views as tabs, with Now selected", () => {
  const html = renderToStaticMarkup(<App />);
  const tabs = [
    ...html.matchAll(/<button[^>]*role="tab"[^>]*>([^<]*)<\/button>/g),
  ];
  expect(tabs.map((tab) => tab[1])).toEqual(["Now", "Workspace", "History"]);
  expect(tabs[0]?.[0]).toContain('aria-selected="true"');
});
