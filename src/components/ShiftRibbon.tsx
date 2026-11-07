"use client";

import { BLOCKS, SHIFT_END, SHIFT_START, fmt } from "@/lib/time";
import type { Block, Plan, PlannedStop, StopState } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * The shift as a schedule: one lane per delivery block, a time axis on top, and each stop as a bar
 * that starts at its simulated arrival and lasts as long as its handover. Bar colour = history-table
 * chance for that attempt. Numbers match the map. All times are simulated estimates.
 */
const LANE_TINT: Record<Block, string> = { morning: "bg-morning/[0.07]", afternoon: "bg-afternoon/[0.09]", evening: "bg-evening/[0.08]" };
const LANE_DOT: Record<Block, string> = { morning: "bg-morning", afternoon: "bg-afternoon", evening: "bg-evening" };

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
  const scheduled = plan.stops.filter((s) => !Number.isNaN(s.arriveMin));
  const end = Math.max(SHIFT_END, ...scheduled.map((s) => s.departMin)) + 20;
  const span = end - SHIFT_START;
  const x = (m: number) => ((m - SHIFT_START) / span) * 100;
  const late = scheduled.filter((s) => s.arriveMin > SHIFT_END);
  const unscheduled = plan.stops.filter((s) => Number.isNaN(s.arriveMin));

  const ticks: number[] = [];
  for (let m = Math.ceil(SHIFT_START / 60) * 60; m <= end; m += 60) ticks.push(m);

  // Inside one lane, stops that would overlap are stacked on extra rows.
  const lanes = BLOCKS.map((b) => {
    const list = scheduled.filter((s) => s.block === b.id).sort((a, c) => a.arriveMin - c.arriveMin);
    const rowEnds: number[] = [];
    const placed = list.map((s) => {
      const left = x(s.arriveMin);
      let row = 0;
      while (rowEnds[row] !== undefined && rowEnds[row] > left - 0.4) row++;
      rowEnds[row] = left + Math.max(2.2, x(s.departMin) - x(s.arriveMin));
      return { s, row };
    });
    return { b, placed, rows: Math.max(1, rowEnds.length) };
  });

  return (
    <div>
      <div className="grid grid-cols-[112px_1fr] gap-x-2">
        <div />
        <div className="relative h-6 text-[11px] text-ink-faint" aria-hidden>
          {ticks.map((m) => (
            <span key={m} className={cn("absolute -translate-x-1/2", (m / 60) % 2 === 1 && "hidden sm:inline")} style={{ left: `${x(m)}%` }}>
              {fmt(m)}
            </span>
          ))}
        </div>

        {lanes.map(({ b, placed, rows }) => (
          <LaneRow key={b.id} label={b.label} sub={`${fmt(b.start)}–${fmt(b.end)}`} dot={LANE_DOT[b.id]} count={placed.length}>
            <div className={cn("relative rounded-md", LANE_TINT[b.id])} style={{ height: rows * 26 + 8 }}>
              {ticks.map((m) => (
                <div key={m} className="absolute top-0 bottom-0 border-l border-line/70" style={{ left: `${x(m)}%` }} />
              ))}
              {placed.map(({ s, row }, i) => (
                <StopBar key={s.stopId} s={s} row={row} i={i} x={x} done={isDone(states[s.stopId])} isSel={selected === s.stopId} onSelect={onSelect} />
              ))}
              {placed.length === 0 ? <span className="absolute left-2 top-1.5 text-xs text-ink-faint">no stops in this block</span> : null}
              <Overlays x={x} clockMin={clockMin} end={end} lane={b.id} />
            </div>
          </LaneRow>
        ))}
      </div>

      {late.length ? (
        <p className="mt-2 text-xs font-medium text-bad">
          {late.length} stop{late.length === 1 ? "" : "s"} arrive after the {fmt(SHIFT_END)} shift end (#{late.map((l) => l.seq).join(", #")}). The dispatcher must review or move parcels.
        </p>
      ) : null}
      {unscheduled.length ? (
        <p className="mt-1 text-xs font-medium text-warn">
          {unscheduled.length} stop{unscheduled.length === 1 ? "" : "s"} could not be scheduled: {unscheduled.map((u) => u.stopId).join(", ")}.
        </p>
      ) : null}

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-faint">
        <span>Bar number = stop order (same as the map). Bar length = handover time. “!” = flagged for the dispatcher.</span>
        <Key tone="bg-ok" text="≥80% chance" />
        <Key tone="bg-warn" text="65–79%" />
        <Key tone="bg-bad" text="<65%" />
        <Key tone="bg-info" text="pickup (not estimated)" />
        <Key tone="bg-ink-faint/40" text="done" />
        <span>Times are simulated estimates (speed, handover and search times are assumptions). Chance = history-table estimate for this attempt.</span>
      </div>
    </div>
  );
}

function isDone(st?: StopState) {
  return st?.status === "delivered" || st?.status === "failed";
}

function LaneRow({ label, sub, dot, count, children }: { label: string; sub: string; dot: string; count: number; children: React.ReactNode }) {
  return (
    <>
      <div className="flex flex-col justify-center py-1 text-xs leading-4">
        <span className="inline-flex items-center gap-1.5 font-semibold text-ink-soft">
          <span className={cn("size-2 rounded-full", dot)} /> {label} <span className="font-normal text-ink-faint">· {count} stop{count === 1 ? "" : "s"}</span>
        </span>
        <span className="whitespace-nowrap pl-3.5 text-ink-faint">{sub}</span>
      </div>
      <div className="py-1">{children}</div>
    </>
  );
}

function Overlays({ x, clockMin, end, lane }: { x: (m: number) => number; clockMin?: number; end: number; lane: Block }) {
  return (
    <>
      {end > SHIFT_END ? <div className="absolute top-0 bottom-0 border-l-2 border-dashed border-bad/70" style={{ left: `${x(SHIFT_END)}%` }} title={`Shift end ${fmt(SHIFT_END)}`} /> : null}
      {lane === "evening" ? (
        <span className="absolute top-0.5 -translate-x-full whitespace-nowrap rounded bg-bad-tint px-1 text-[10px] font-medium text-bad" style={{ left: `calc(${x(SHIFT_END)}% - 4px)` }}>
          shift end {fmt(SHIFT_END)}
        </span>
      ) : null}
      {clockMin !== undefined && clockMin > SHIFT_START ? <div className="absolute top-0 bottom-0 w-0.5 bg-brand" style={{ left: `${x(clockMin)}%` }} title={`Simulated clock ${fmt(clockMin)}`} /> : null}
    </>
  );
}

function StopBar({ s, row, i, x, done, isSel, onSelect }: { s: PlannedStop; row: number; i: number; x: (m: number) => number; done: boolean; isSel: boolean; onSelect?: (id: string) => void }) {
  const tone = s.p === null ? "bg-info" : s.p >= 0.8 ? "bg-ok" : s.p >= 0.65 ? "bg-warn" : "bg-bad";
  const flagged = s.flags.length > 0 && !done;
  const lateStop = s.arriveMin > SHIFT_END && !done;
  const width = Math.max(2.2, x(s.departMin) - x(s.arriveMin));
  return (
    <button
      type="button"
      onClick={() => onSelect?.(s.stopId)}
      className={cn(
        "sc-pop absolute flex h-[22px] min-w-[24px] items-center justify-center rounded-md px-1 text-[11px] font-semibold leading-none text-white shadow-sm transition-transform hover:-translate-y-px",
        done ? "bg-ink-faint/40" : tone,
        isSel && "z-10 ring-2 ring-ink ring-offset-1",
        (flagged || lateStop) && "outline outline-2 outline-offset-1 outline-bad",
      )}
      style={{ left: `${x(s.arriveMin)}%`, width: `${width}%`, top: 4 + row * 26, ["--d" as string]: `${Math.min(i * 0.02, 0.6)}s` }}
      aria-label={`Stop ${s.seq}, ${s.stopId}, arrive ${fmt(s.arriveMin)}${flagged ? ", flagged for dispatcher" : ""}, chance ${s.p === null ? "not estimated" : Math.round(s.p * 100) + "%"}`}
      title={`#${s.seq} ${s.stopId} · arrive ${fmt(s.arriveMin)}, leave ${fmt(s.departMin)} · ${s.p === null ? "not estimated" : Math.round(s.p * 100) + "%"}`}
    >
      {s.seq}
      {flagged ? "!" : ""}
    </button>
  );
}

function Key({ tone, text }: { tone: string; text: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={cn("h-3 w-3 rounded-sm", tone)} /> {text}
    </span>
  );
}
