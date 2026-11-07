"use client";

import { ChevronDown, CircleHelp } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

// Presentation mode: short labels and big numbers for the stage; every detail stays one click away.
const KEY = "s-compass-present-v1";
const ANIM_KEY = "s-compass-anim-v1";
const Ctx = React.createContext<{ present: boolean; setPresent: (v: boolean) => void; anim: boolean; setAnim: (v: boolean) => void }>({ present: true, setPresent: () => {}, anim: true, setAnim: () => {} });

export function PresentProvider({ children }: { children: React.ReactNode }) {
  const [present, setState] = React.useState(true);
  const [anim, setAnimState] = React.useState(true);
  React.useEffect(() => {
    try {
      const v = window.localStorage.getItem(KEY);
      if (v === "off") setState(false);
      if (window.localStorage.getItem(ANIM_KEY) === "off") {
        setAnimState(false);
        document.documentElement.dataset.anim = "off";
      }
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
  const setAnim = React.useCallback((v: boolean) => {
    setAnimState(v);
    document.documentElement.dataset.anim = v ? "on" : "off";
    try {
      window.localStorage.setItem(ANIM_KEY, v ? "on" : "off");
    } catch {
      /* ignore */
    }
  }, []);
  return <Ctx.Provider value={{ present, setPresent, anim, setAnim }}>{children}</Ctx.Provider>;
}

export function usePresent() {
  return React.useContext(Ctx);
}

/** True when motion is allowed: the Animation switch is on and the system does not ask for reduced motion. */
export function useMotion() {
  const { anim } = usePresent();
  const [reduced, setReduced] = React.useState(false);
  React.useEffect(() => {
    const q = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(q.matches);
    const f = () => setReduced(q.matches);
    q.addEventListener("change", f);
    return () => q.removeEventListener("change", f);
  }, []);
  return anim && !reduced;
}

/** Counts a number up from one value to another once, when it first appears. */
export function CountUp({ from, to, format, ms = 800 }: { from: number; to: number; format: (v: number) => string; ms?: number }) {
  const motion = useMotion();
  const [v, setV] = React.useState(to);
  React.useEffect(() => {
    if (!motion || from === to) {
      setV(to);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / ms);
      const e = 1 - Math.pow(1 - k, 3);
      setV(from + (to - from) * e);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    setV(from);
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [from, to, ms, motion]);
  return <>{format(v)}</>;
}

/** In presentation mode the content is folded behind a "Show details" button (it opens and closes smoothly); otherwise it is always shown. */
export function Details({ label = "Show details", children, className }: { label?: string; children: React.ReactNode; className?: string }) {
  const { present } = usePresent();
  const [open, setOpen] = React.useState(false);
  if (!present) return <>{children}</>;
  return (
    <div className={className}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="inline-flex items-center gap-1 text-sm font-medium text-info hover:underline">
        <ChevronDown className={cn("size-4 transition-transform duration-200", open && "rotate-180")} /> {open ? "Hide details" : label}
      </button>
      <div className={cn("grid transition-[grid-template-rows,opacity] duration-300 ease-out", open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}>
        <div className="overflow-hidden" aria-hidden={!open} inert={!open}>
          <div className="mt-3">{children}</div>
        </div>
      </div>
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
