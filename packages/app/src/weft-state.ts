import type {
  CalendarDay,
  Query,
  QueryResults,
  QueryType,
  TableName,
  Weft,
} from "@weft/contracts";
import { useEffect, useState } from "react";

import { localDay } from "./follow-up-date.ts";

export /** Today on this device's calendar, moving on at local midnight and when the window comes back. */
function useToday(): CalendarDay {
  const [today, setToday] = useState(() => localDay());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    function check() {
      setToday(localDay());
      clearTimeout(timer);
      const midnight = new Date();
      midnight.setHours(24, 0, 0, 0);
      timer = setTimeout(check, midnight.getTime() - Date.now() + 50);
    }
    check();
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, []);
  return today;
}

/** Every Entry, read again after each change to the tables it comes from. */
export function useEntries(weft: Weft) {
  const { items, failure } = useRead(
    weft,
    "entries",
    ["entries", "entryThreads"],
    "entries",
  );
  return { entries: items, failure };
}

export function useThreads(weft: Weft) {
  const { items, failure } = useRead(weft, "threads", ["threads"], "threads");
  return { threads: items, failure };
}

function useRead<Q extends QueryType>(
  weft: Weft,
  type: Q,
  tables: readonly TableName[],
  noun: string,
) {
  const [items, setItems] = useState<QueryResults[Q]>([]);
  const [failure, setFailure] = useState<string>();
  useEffect(() => {
    let latest = 0;
    let stopped = false;
    function load() {
      const reading = ++latest;
      weft.read({ type } as Query).then(
        (read) => {
          if (stopped || reading !== latest) return;
          setItems(read as QueryResults[Q]);
          setFailure(undefined);
        },
        (error: unknown) => {
          if (stopped || reading !== latest) return;
          setFailure(`Weft couldn't show your ${noun}: ${messageOf(error)}`);
        },
      );
    }
    const unsubscribe = weft.subscribe((change) => {
      if (change.tables.some((table) => tables.includes(table))) load();
    });
    load();
    return () => {
      stopped = true;
      unsubscribe();
    };
  }, [weft]);
  return { items, failure };
}

/** "Nov 8", with the year when it is not this year. */
export function writtenOn(instant: string): string {
  const date = new Date(instant);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year:
      date.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  });
}

export function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
