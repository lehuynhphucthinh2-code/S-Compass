import type { Block } from "./types";

/** Delivery blocks used by the planner (team assumption: the dataset only records morning/afternoon/evening). */
export const BLOCKS: { id: Block; label: string; start: number; end: number }[] = [
  { id: "morning", label: "Morning", start: 8 * 60, end: 11 * 60 + 30 },
  { id: "afternoon", label: "Afternoon", start: 11 * 60 + 30, end: 17 * 60 },
  { id: "evening", label: "Evening", start: 17 * 60, end: 20 * 60 + 30 },
];

export const SHIFT_START = 8 * 60;
export const SHIFT_END = 20 * 60 + 30;

export function blockInfo(b: Block) {
  return BLOCKS.find((x) => x.id === b)!;
}

export function blockLabel(b: Block) {
  const x = blockInfo(b);
  return `${x.label} ${fmt(x.start)}–${fmt(x.end)}`;
}

export function fmt(min: number): string {
  const m = Math.round(min);
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export function parseHHMM(s: string): number {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
}

export function blockOfTime(min: number): Block {
  if (min < BLOCKS[1].start) return "morning";
  if (min < BLOCKS[2].start) return "afternoon";
  return "evening";
}
