"use client";

import * as React from "react";
import { fixtures, loadImportedLocal, saveImportedLocal, setImported, shiftById } from "@/lib/data";
import { cardsFor, ensureShiftState, initialState, log, type DemoState } from "@/lib/demoState";
import { getAdapter, type PersistenceAdapter, type SaveResult } from "@/lib/persistence";
import type { Plan, Shift, StopCard } from "@/lib/types";

interface DemoContextValue {
  state: DemoState;
  update: (fn: (s: DemoState) => DemoState) => void;
  reset: () => void;
  shift: Shift;
  cards: Record<string, StopCard>;
  plan: Plan | null;
  adapter: PersistenceAdapter;
  saveStatus: SaveResult | null;
  loadError: string | null;
}

const DemoContext = React.createContext<DemoContextValue | null>(null);

export function DemoProvider({ children }: { children: React.ReactNode }) {
  const adapter = React.useMemo(() => getAdapter(), []);
  const [state, setState] = React.useState<DemoState | null>(null);
  const [saveStatus, setSaveStatus] = React.useState<SaveResult | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const dirty = React.useRef(false);

  React.useEffect(() => {
    let alive = true;
    adapter
      .load()
      .then((s) => {
        if (!alive) return;
        // Imported rider-days live in this browser only; register them before any shift is looked up.
        const imported = loadImportedLocal();
        if (imported) setImported(imported);
        let next = s ?? initialState();
        if (!fixtures.shifts.some((x) => x.id === next.shiftId)) next = { ...next, shiftId: fixtures.shifts[0].id };
        setState(ensureShiftState(next, next.shiftId));
      })
      .catch((e: Error) => {
        if (!alive) return;
        setLoadError(e.message);
        setState(initialState());
      });
    return () => {
      alive = false;
    };
  }, [adapter]);

  React.useEffect(() => {
    if (!state || !dirty.current) return;
    const t = window.setTimeout(() => {
      adapter.save(state).then(setSaveStatus);
    }, 350);
    return () => window.clearTimeout(t);
  }, [state, adapter]);

  const update = React.useCallback((fn: (s: DemoState) => DemoState) => {
    dirty.current = true;
    setState((s) => (s ? fn(s) : s));
  }, []);

  const reset = React.useCallback(() => {
    dirty.current = true;
    setImported(null);
    saveImportedLocal(null);
    adapter.clear().finally(() => {
      setState(log(initialState(), { type: "demo_reset", summary: "Demo reset to the original fixtures" }));
    });
  }, [adapter]);

  const value = React.useMemo<DemoContextValue | null>(() => {
    if (!state) return null;
    return {
      state,
      update,
      reset,
      shift: shiftById(state.shiftId),
      cards: cardsFor(state),
      plan: state.currentPlan[state.shiftId],
      adapter,
      saveStatus,
      loadError,
    };
  }, [state, update, reset, adapter, saveStatus, loadError]);

  if (!value) {
    return <LoadingScreen />;
  }
  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemo() {
  const ctx = React.useContext(DemoContext);
  if (!ctx) throw new Error("useDemo must be used inside DemoProvider");
  return ctx;
}

/** Shown for a moment while the saved demo state is read, so the screen is never blank. */
function LoadingScreen() {
  return (
    <div className="min-h-screen" role="status" aria-label="Loading S-Compass">
      <div className="border-b border-line bg-surface px-4 py-3">
        <div className="mx-auto flex max-w-[1440px] items-center gap-3">
          <div className="size-9 animate-pulse rounded-lg bg-brand/80" />
          <div className="space-y-1.5">
            <div className="h-3.5 w-24 animate-pulse rounded bg-line" />
            <div className="h-2.5 w-32 animate-pulse rounded bg-line/70" />
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-[1440px] space-y-4 px-4 py-5">
        <div className="h-12 animate-pulse rounded-xl bg-line/60" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-line/60" />
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-xl bg-line/50" />
        <p className="text-sm text-ink-faint">Loading demo data…</p>
      </div>
    </div>
  );
}
