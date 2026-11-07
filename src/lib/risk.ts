import { explainTable } from "./successTable";
import { messySampleRows, parseTable, type IntakeResult } from "./intake";
import { makePlan } from "./planner";
import { SHIFT_END } from "./time";
import type { Plan, PlanMethod, Shift, StopCard, StopState } from "./types";

/** Risk desk: every scenario runs the same planner, scorer and intake code as the rest of the app. */

const pending = (ids: string[]) => Object.fromEntries(ids.map((id) => [id, { status: "pending", buyer: { kind: "none" } } as StopState]));

export interface OverloadResult {
  plan: Plan;
  parcels: number;
  onTime: number;
  overflow: number;
  ms: number;
}

/** Builds a bigger batch by repeating the real stops of one demo shift (new ids), then plans it. */
export function overloadScenario(base: Shift, parcels: number, cards: Record<string, StopCard>, method: PlanMethod = "rules"): OverloadResult {
  const stops = Array.from({ length: parcels }, (_, i) => {
    const src = base.stops[i % base.stops.length];
    return { ...src, id: `ovl-${i + 1}`, receivedOrder: i + 1 };
  });
  const shift: Shift = { ...base, id: `ovl-${parcels}`, stops };
  const t0 = performance.now();
  const plan = makePlan({ shift, method, cards, stopStates: pending(stops.map((s) => s.id)) });
  const ms = performance.now() - t0;
  const scheduled = plan.stops.filter((s) => !Number.isNaN(s.arriveMin));
  const onTime = scheduled.filter((s) => s.arriveMin <= SHIFT_END).length;
  return { plan, parcels, onTime, overflow: parcels - onTime, ms };
}

export interface FallbackRow {
  method: PlanMethod;
  expectedSuccess: number;
  endMin: number;
  flagged: number;
  lowChance: number;
}

/** The same shift planned three ways, so the dispatcher can fall back if one method is not trusted. */
export function fallbackLadder(shift: Shift, cards: Record<string, StopCard>, states: Record<string, StopState>): FallbackRow[] {
  return (["model", "rules", "baseline"] as PlanMethod[]).map((method) => {
    const p = makePlan({ shift, method, cards, stopStates: states });
    return { method, expectedSuccess: p.totals.expectedSuccess, endMin: p.totals.endMin, flagged: p.totals.flagged, lowChance: p.totals.lowChance };
  });
}

export interface ThinGroup {
  stopId: string;
  seq: number;
  label: string;
  attempts: number;
  rawRate: number | null;
  p: number;
}

/** Stops whose estimate rests on the fewest past attempts. Smoothing pulls these toward the average. */
export function thinGroups(shift: Shift, plan: Plan, limit = 5): ThinGroup[] {
  const byId = Object.fromEntries(shift.stops.map((s) => [s.id, s]));
  const rows: ThinGroup[] = [];
  for (const ps of plan.stops) {
    const st = byId[ps.stopId];
    if (!st || ps.p === null) continue;
    const x = explainTable(st.locationType, ps.block, shift.isWeekend ? "weekend" : "weekday", st.payment);
    rows.push({ stopId: ps.stopId, seq: ps.seq, label: `${st.locationType} · ${ps.block} · ${st.payment}`, attempts: x.attempts, rawRate: x.rawRate, p: x.p });
  }
  return rows.sort((a, b) => a.attempts - b.attempts).slice(0, limit);
}

export type BadDataKey = "messy" | "empty" | "columns";

export function badDataScenario(key: BadDataKey): IntakeResult {
  if (key === "messy") return parseTable(messySampleRows(), "practice-file-fictional.csv");
  if (key === "empty") return parseTable([], "empty.csv");
  return parseTable(
    [
      ["Name", "Phone", "Notes"],
      ["A", "0900", "x"],
      ["B", "0901", "y"],
    ],
    "wrong-columns.csv",
  );
}
