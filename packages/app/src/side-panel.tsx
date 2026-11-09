import { XIcon } from "lucide-react";
import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

import { Button } from "./components/ui/button.tsx";

export function SidePanel({
  title,
  label,
  onClose,
  style,
  children,
  ...data
}: {
  title: ReactNode;
  label: string;
  onClose: () => void;
  style?: CSSProperties;
  children: ReactNode;
  "data-thread"?: string;
}) {
  useCloseOnEscape(onClose);
  return (
    <aside
      aria-label={label}
      style={style}
      {...data}
      className="sticky top-0 flex h-svh w-[25rem] shrink-0 flex-col gap-4 overflow-y-auto border-s bg-card px-5 pt-4 pb-6 text-card-foreground"
    >
      <header className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-xs font-medium tracking-wider text-muted-foreground uppercase">
          {title}
        </h2>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Close"
          onClick={onClose}
          className="-me-2"
        >
          <XIcon />
        </Button>
      </header>
      {children}
    </aside>
  );
}

/** Escape closes the panel, unless it is closing a menu, a picker or a dialog first. */
function useCloseOnEscape(onClose: () => void) {
  const latest = useRef(onClose);
  latest.current = onClose;
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (
        document.querySelector("[data-open]:not([data-slot=tooltip-content])")
      ) {
        return;
      }
      const active = document.activeElement;
      if (active instanceof HTMLElement && active.matches("input, textarea")) {
        active.blur();
      }
      latest.current();
    }
    // Capturing, so a popup that closes on this Escape is still open when it is checked.
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, []);
}
