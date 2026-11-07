"use client";

import { ChevronDown, CircleHelp } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

// Presentation mode: short labels and big numbers for the stage; every detail stays one click away.
const KEY = "s-compass-present-v1";
const Ctx = React.createContext<{ present: boolean; setPresent: (v: boolean) => void }>({ present: true, setPresent: () => {} });

export function PresentProvider({ children }: { children: React.ReactNode }) {
  const [present, setState] = React.useState(true);
  React.useEffect(() => {
    try {
      const v = window.localStorage.getItem(KEY);
      if (v === "off") setState(false);
    } catch {
      /* storage blocked: keep the default */
    }
  }, []);
  const setPresent = React.useCallback((v: boolean) => {
    setState(v);
    try {
      window.localStorage.setItem(KEY, v ? "on" : "off");
    } catch {
      /* ignore */
    }
  }, []);
  return <Ctx.Provider value={{ present, setPresent }}>{children}</Ctx.Provider>;
}

export function usePresent() {
  return React.useContext(Ctx);
}

/** In presentation mode the content is folded behind a "Show details" button; otherwise it is always shown. */
export function Details({ label = "Show details", children, className }: { label?: string; children: React.ReactNode; className?: string }) {
  const { present } = usePresent();
  const [open, setOpen] = React.useState(false);
  if (!present) return <>{children}</>;
  return (
    <div className={className}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="inline-flex items-center gap-1 text-sm font-medium text-info hover:underline">
        <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} /> {open ? "Hide details" : label}
      </button>
      {open ? <div className="mt-3">{children}</div> : null}
    </div>
  );
}

/** A small “?” that explains a term on hover or tap. */
export function Hint({ text, className }: { text: string; className?: string }) {
  const [open, setOpen] = React.useState(false);
  return (
    <span className={cn("relative inline-flex align-middle", className)}>
      <button type="button" aria-label={text} title={text} onClick={() => setOpen((o) => !o)} onBlur={() => setOpen(false)} className="text-ink-faint hover:text-ink">
        <CircleHelp className="size-4" />
      </button>
      {open ? (
        <span role="tooltip" className="absolute left-1/2 top-6 z-20 w-64 -translate-x-1/2 rounded-lg bg-ink px-3 py-2 text-xs font-normal leading-5 text-white shadow-lg">
          {text}
        </span>
      ) : null}
    </span>
  );
}
