import { expect, test } from "bun:test";
import type { Weft } from "@weft/contracts";
import { renderToStaticMarkup } from "react-dom/server";

import { App } from "./app.tsx";
import { TimeField } from "./follow-up-date-fields.tsx";
import { RepeatField } from "./repeat-field.tsx";

const weft: Weft = {
  run: () => Promise.resolve(),
  read: () => Promise.resolve([]) as never,
  subscribe: () => () => {},
};

test("the header has the three views as tabs, with Now selected", () => {
  const html = renderToStaticMarkup(<App weft={weft} />);
  const tabs = [
    ...html.matchAll(/<button[^>]*role="tab"[^>]*>([^<]*)<\/button>/g),
  ];
  expect(tabs.map((tab) => tab[1])).toEqual(["Now", "Workspace", "History"]);
  expect(tabs[0]?.[0]).toContain('aria-selected="true"');
});

test("Now has the capture box, with Add off until something is typed", () => {
  const html = renderToStaticMarkup(<App weft={weft} />);
  expect(html).toContain('placeholder="What&#x27;s on your mind?"');
  expect(html).toMatch(
    /<button[^>]*type="submit"[^>]*disabled=""[^>]*>Add<\/button>/,
  );
});

test("Now and its Follow-up date fields use no native date, time, number or select field", () => {
  const none = () => {};
  const html = renderToStaticMarkup(
    <>
      <App weft={weft} />
      <TimeField value="09:30" onChange={none} />
      {(
        [
          { kind: "days", every: "2" },
          { kind: "weekly", weekdays: [0] },
          { kind: "monthly", day: "15" },
        ] as const
      ).map((value) => (
        <RepeatField
          key={value.kind}
          value={value}
          onKind={none}
          onChange={none}
        />
      ))}
    </>,
  );
  expect(html).toContain('aria-label="Time"');
  expect(html).toContain('aria-label="Weekdays"');
  expect(html).toContain('aria-label="Day of the month"');
  expect(html).not.toMatch(/<select|type="(date|time|number)"/);
});
