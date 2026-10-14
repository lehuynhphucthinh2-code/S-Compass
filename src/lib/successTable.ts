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
