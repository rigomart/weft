import type { CalendarDay, EntryListItem, Weft } from "@weft/contracts";
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
      if (
        change.tables.includes("entries") ||
        change.tables.includes("entryThreads")
      ) {
        load();
      }
    });
    load();
    return () => {
      stopped = true;
      unsubscribe();
    };
  }, [weft]);
  return { entries, failure };
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
