"use client";

import { BLOCKS, SHIFT_END, SHIFT_START, fmt } from "@/lib/time";
import type { Plan, StopState } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * The shift as a time ribbon: each stop sits at its simulated arrival time, coloured by
 * its history-table chance of success. This is where the window choice becomes visible.
 */
export function ShiftRibbon({
  plan,
  states,
  clockMin,
  onSelect,
  selected,
}: {
  plan: Plan;
  states: Record<string, StopState>;
  clockMin?: number;
  onSelect?: (id: string) => void;
  selected?: string | null;
}) {
  const end = Math.max(SHIFT_END, ...plan.stops.filter((s) => !Number.isNaN(s.departMin)).map((s) => s.departMin)) + 15;
  const span = end - SHIFT_START;
  const x = (m: number) => ((m - SHIFT_START) / span) * 100;
  const stops = plan.stops.filter((s) => !Number.isNaN(s.arriveMin));
  const lanes: number[] = [];
  const placed = stops.map((s) => {
    let lane = 0;
    while (lanes[lane] !== undefined && lanes[lane] > x(s.arriveMin) - 2.6) lane++;
    lanes[lane] = x(s.arriveMin);
    return { s, lane };
  });
  const laneCount = Math.max(1, ...placed.map((p) => p.lane + 1));
  const late = stops.filter((s) => s.arriveMin > SHIFT_END);
  const unscheduled = plan.stops.filter((s) => Number.isNaN(s.arriveMin));
  const ticks: number[] = [];
  for (let m = Math.ceil(SHIFT_START / 120) * 120; m <= end; m += 120) ticks.push(m);

  return (
    <div>
      <div className="relative h-5 text-[11px] text-ink-faint" aria-hidden>
        {ticks.map((m) => (
          <span key={m} className="absolute -translate-x-1/2" style={{ left: `${x(m)}%` }}>
            {fmt(m)}
          </span>
        ))}
      </div>
      <div className="relative" style={{ height: 30 + laneCount * 22 }}>
        {BLOCKS.map((b) => (
          <div
            key={b.id}
            className={cn(
              "absolute top-0 bottom-0 border-l border-line",
              b.id === "morning" ? "bg-morning/[0.07]" : b.id === "afternoon" ? "bg-afternoon/[0.08]" : "bg-evening/[0.08]",
            )}
            style={{ left: `${x(b.start)}%`, width: `${x(b.end) - x(b.start)}%` }}
          >
            <span className="absolute left-1.5 top-1 text-[11px] font-medium text-ink-soft">
              {b.label} {fmt(b.start)}
            </span>
          </div>
        ))}
        {end > SHIFT_END + 20 ? (
          <div className="absolute top-0 bottom-0 bg-bad/[0.08]" style={{ left: `${x(SHIFT_END)}%`, right: 0 }}>
            <span className="absolute left-1 top-1 text-[11px] text-bad">after shift</span>
          </div>
        ) : null}
        {clockMin !== undefined && clockMin > SHIFT_START ? (
          <div className="absolute top-0 bottom-0 w-0.5 bg-brand" style={{ left: `${x(clockMin)}%` }} title={`Simulated clock ${fmt(clockMin)}`} />
        ) : null}
        {placed.map(({ s, lane }) => {
          const st = states[s.stopId]?.status;
          const done = st === "delivered" || st === "failed";
          const tone = s.p === null ? "bg-info" : s.p >= 0.8 ? "bg-ok" : s.p >= 0.65 ? "bg-warn" : "bg-bad";
          return (
            <button
              key={s.stopId}
              type="button"
              onClick={() => onSelect?.(s.stopId)}
              className={cn(
                "absolute flex h-[18px] min-w-[22px] -translate-x-1/2 items-center justify-center rounded-sm px-0.5 text-[10px] font-semibold leading-none text-white ring-offset-1",
                done ? "bg-ink-faint/40" : tone,
                selected === s.stopId && "ring-2 ring-brand",
                s.flags.length > 0 && !done && "outline outline-2 outline-bad",
              )}
              style={{ left: `${x(s.arriveMin)}%`, top: 24 + lane * 22 }}
              aria-label={`Stop ${s.seq}, ${s.stopId} at ${fmt(s.arriveMin)}${s.flags.length ? ", flagged for dispatcher" : ""}, chance ${s.p === null ? "not estimated" : Math.round(s.p * 100) + "%"}`}
              title={`#${s.seq} ${s.stopId} · arrive ${fmt(s.arriveMin)}, leave ${fmt(s.departMin)} · ${s.p === null ? "not estimated" : Math.round(s.p * 100) + "%"}`}
            >
              {s.seq}
              {s.flags.length > 0 && !done ? "!" : ""}
            </button>
          );
        })}
      </div>
      {late.length ? <p className="mt-1 text-xs font-medium text-bad">{late.length} stop{late.length === 1 ? "" : "s"} arrive after the {fmt(SHIFT_END)} shift end ({late.map((x) => `#${x.seq}`).join(", ")}). The dispatcher must review or move parcels.</p> : null}
      {unscheduled.length ? <p className="mt-1 text-xs font-medium text-warn">{unscheduled.length} stop{unscheduled.length === 1 ? "" : "s"} could not be scheduled: {unscheduled.map((x) => x.stopId).join(", ")}.</p> : null}
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-faint">
        <span>Number = stop order (same as the map). “!” = flagged for the dispatcher.</span>
        <span className="inline-flex items-center gap-1">
          <span className="h-3 w-2 rounded-sm bg-ok" /> ≥80% chance
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-3 w-2 rounded-sm bg-warn" /> 65–79%
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-3 w-2 rounded-sm bg-bad" /> &lt;65%
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-3 w-2 rounded-sm bg-info" /> pickup (not estimated)
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-3 w-2 rounded-sm bg-ink-faint/40" /> done
        </span>
        <span>Times are simulated estimates (speed, handover and search times are assumptions). Chance = history-table estimate for this attempt.</span>
      </div>
    </div>
  );
}
