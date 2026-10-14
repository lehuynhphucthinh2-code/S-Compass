"use client";

import * as React from "react";
import { blockColor } from "@/components/bits";
import { fixtures, pickupPoints } from "@/lib/data";
import type { Plan, Point, StopState } from "@/lib/types";

/** Bounding box of every position in the demo zone (so the map does not jump between plans). */
const ALL: Point[] = [
  fixtures.hub.pos,
  ...pickupPoints.map((p) => p.pos),
  ...fixtures.knowledge.flatMap((k) => (k.entranceCandidate ? [k.entranceCandidate] : [])),
  ...fixtures.shifts.flatMap((s) => s.stops.flatMap((x) => (x.pin ? [x.pin] : []))),
];
const PAD = 120;
const minX = Math.min(...ALL.map((p) => p[0])) - PAD;
const maxX = Math.max(...ALL.map((p) => p[0])) + PAD;
const minY = Math.min(...ALL.map((p) => p[1])) - PAD;
const maxY = Math.max(...ALL.map((p) => p[1])) + PAD;

export function RouteMap({
  plan,
  states,
  selected,
  onSelect,
  height = 340,
}: {
  plan: Plan | null;
  states: Record<string, StopState>;
  selected?: string | null;
  onSelect?: (stopId: string) => void;
  height?: number;
}) {
  const W = 1000;
  const H = Math.round((W * (maxY - minY)) / (maxX - minX));
  const tx = (p: Point) => [((p[0] - minX) / (maxX - minX)) * W, H - ((p[1] - minY) / (maxY - minY)) * H] as const;
  const stops = plan?.stops ?? [];
  const located = stops.filter((s) => s.point && !Number.isNaN(s.arriveMin));
  const unlocated = stops.filter((s) => !s.point || Number.isNaN(s.arriveMin));

  // group stops that share a drop-off point so their numbers stay readable
  const groups = new Map<string, typeof located>();
  for (const s of located) {
    const k = `${Math.round(s.point![0] / 25)}:${Math.round(s.point![1] / 25)}`;
    groups.set(k, [...(groups.get(k) ?? []), s]);
  }

  const segments: { a: readonly [number, number]; b: readonly [number, number]; color: string; done: boolean }[] = [];
  let prev = tx(fixtures.hub.pos);
  for (const s of located) {
    const cur = tx(s.point!);
    const st = states[s.stopId]?.status;
    segments.push({ a: prev, b: cur, color: blockColor(s.block), done: st === "delivered" || st === "failed" });
    prev = cur;
  }
  const hub = tx(fixtures.hub.pos);

  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Schematic route map" className="w-full rounded-lg bg-[#f7f8fa]" style={{ maxHeight: height }}>
        <defs>
          <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
            <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#e7eaf0" strokeWidth="1.5" />
          </pattern>
        </defs>
        <rect width={W} height={H} fill="url(#grid)" />
        {pickupPoints.map((p) => {
          const [x, y] = tx(p.pos);
          return (
            <g key={p.id}>
              <rect x={x - 12} y={y - 12} width={24} height={24} rx={5} fill="#fff" stroke="#1e8e5a" strokeWidth={3} />
              <text x={x + 18} y={y + 7} fontSize={20} fill="#1e8e5a">
                pickup
              </text>
            </g>
          );
        })}
        {segments.map((sg, i) => (
          <line
            key={i}
            x1={sg.a[0]}
            y1={sg.a[1]}
            x2={sg.b[0]}
            y2={sg.b[1]}
            stroke={sg.color}
            strokeWidth={sg.done ? 3 : 5}
            strokeOpacity={sg.done ? 0.35 : 0.8}
            strokeDasharray={sg.done ? "10 10" : undefined}
          />
        ))}
        <g>
          <rect x={hub[0] - 26} y={hub[1] - 18} width={52} height={36} rx={6} fill="#14213d" />
          <text x={hub[0]} y={hub[1] + 7} textAnchor="middle" fontSize={19} fontWeight={600} fill="#fff">
            HUB
          </text>
        </g>
        {Array.from(groups.values()).map((g) => {
          const [x, y] = tx(g[0].point!);
          const open = g.filter((s) => {
            const st = states[s.stopId]?.status;
            return st !== "delivered" && st !== "failed";
          });
          const lead = open[0] ?? g[0];
          const done = open.length === 0;
          const isSel = g.some((s) => s.stopId === selected);
          const label = g.length > 1 ? `${g.length}` : `${g[0].seq}`;
          const blocks = Array.from(new Set(open.map((s) => s.block)));
          return (
            <g
              key={g[0].stopId}
              role={onSelect ? "button" : undefined}
              tabIndex={onSelect ? 0 : undefined}
              aria-label={g.length > 1 ? `${g.length} stops at one site: ${g.map((s) => s.seq).join(", ")}` : `Stop ${g[0].seq}, ${g[0].stopId}`}
              onClick={() => onSelect?.(lead.stopId)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSelect?.(lead.stopId);
              }}
              style={{ cursor: onSelect ? "pointer" : undefined }}
            >
              <title>{g.map((s) => `#${s.seq} ${s.stopId}`).join(", ")}</title>
              <circle cx={x} cy={y} r={(g.length > 1 ? 26 : 19) + (isSel ? 4 : 0)} fill={done ? "#fff" : blockColor(lead.block)} stroke={isSel ? "#ee4d2d" : done ? "#8a93a8" : "#fff"} strokeWidth={isSel ? 6 : 3} />
              {blocks.length > 1
                ? blocks.slice(1).map((b, i) => <circle key={b} cx={x + 22 + i * 15} cy={y - 20} r={8} fill={blockColor(b)} stroke="#fff" strokeWidth={1.5} />)
                : null}
              <text x={x} y={y + 7} textAnchor="middle" fontSize={g.length > 1 ? 22 : 19} fontWeight={600} fill={done ? "#4a5672" : "#fff"}>
                {label}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-faint">
        <span>Schematic, not a street map: de-identified dataset positions, straight lines between stops. A bigger circle with a number = several stops at one site.</span>
        {(["morning", "afternoon", "evening"] as const).map((b) => (
          <span key={b} className="inline-flex items-center gap-1">
            <span className="size-2.5 rounded-full" style={{ background: blockColor(b) }} /> {b}
          </span>
        ))}
        {unlocated.length ? <span className="text-warn">{unlocated.length} stop(s) not on the map (no location or not scheduled)</span> : null}
      </figcaption>
    </figure>
  );
}
