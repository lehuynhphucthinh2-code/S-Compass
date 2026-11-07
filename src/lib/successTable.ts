import { successTable } from "./data";
import type { Block, DayType, LocationType, Payment } from "./types";

/**
 * Historical success table: P(attempt delivered) for location type x block x day type x payment.
 * Built from 1–30 Sep 2026 dataset attempts and shrunk toward the overall rate
 * (5 pseudo-attempts). This is the scorer used for every plan estimate, so all
 * methods are compared with the same yardstick.
 */
export function tableP(type: LocationType, block: Block, day: DayType, payment: Payment): { p: number; n: number } {
  const cell = successTable.cells[`${type}|${block}|${day}|${payment}`];
  if (!cell) return { p: successTable.prior, n: 0 };
  return cell;
}

export interface TableExplain {
  key: string;
  found: boolean;
  p: number;
  attempts: number;
  /** Rebuilt from the stored rate: the table keeps p and n, so successes are rounded back from them. */
  successes: number;
  rawRate: number | null;
  prior: number;
  strength: number;
  trainedOn: string;
}

/** Shows how tableP() got its number, using only values stored in the table. */
export function explainTable(type: LocationType, block: Block, day: DayType, payment: Payment): TableExplain {
  const key = `${type}|${block}|${day}|${payment}`;
  const cell = successTable.cells[key];
  const { prior, priorStrength: strength, trainedOn } = successTable;
  if (!cell) return { key, found: false, p: prior, attempts: 0, successes: 0, rawRate: null, prior, strength, trainedOn };
  const successes = Math.round(cell.p * (cell.n + strength) - strength * prior);
  return { key, found: true, p: cell.p, attempts: cell.n, successes, rawRate: cell.n ? successes / cell.n : null, prior, strength, trainedOn };
}
