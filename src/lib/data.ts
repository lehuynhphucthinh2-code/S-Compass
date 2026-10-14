import fixturesJson from "@/data/demo-fixtures.json";
import historicalJson from "@/data/historical-stats.json";
import tableJson from "@/data/success-table.json";
import modelJson from "@/data/model.json";
import evaluationJson from "@/data/evaluation.json";
import type { KnowledgeRecord, PickupPoint, Rider, Shift } from "./types";

export const fixtures = fixturesJson as unknown as {
  riders: Rider[];
  knowledge: KnowledgeRecord[];
  shifts: Shift[];
  note: string;
};

export const historical = historicalJson;
export const successTable = tableJson as {
  prior: number;
  priorStrength: number;
  trainedOn: string;
  cells: Record<string, { p: number; n: number }>;
};
export const modelSpec = modelJson as unknown as {
  kind: string;
  target: string;
  trainedOn: string;
  nTrain: number;
  holdout: string;
  nHoldout: number;
  features: string[];
  coef: Record<string, number>;
  intercept: number;
  serviceMean: number;
  serviceSd: number;
  typeRate: Record<string, number>;
  typeWindowRate: Record<string, number>;
  priorStrength: number;
};
export const evaluation = evaluationJson;

export const knowledgeByKey: Record<string, KnowledgeRecord> = Object.fromEntries(
  fixtures.knowledge.map((k) => [k.key, k]),
);

/** Fictional partner pickup points used by the Buyer Confirm simulation (demo fixtures, two per zone). */
export const allPickupPoints: PickupPoint[] = fixtures.riders.flatMap((r) => r.pickupPoints);

export function riderById(id: string): Rider {
  const r = fixtures.riders.find((x) => x.id === id);
  if (!r) throw new Error(`Unknown rider ${id}`);
  return r;
}

export function riderOfShift(shift: Shift): Rider {
  return riderById(shift.riderId);
}

export function knowledgeForRider(riderId: string): KnowledgeRecord[] {
  return fixtures.knowledge.filter((k) => k.zone === riderId);
}

/** A backup rider used only as the target of an explicit parcel transfer (demo fixture). */
export const BACKUP_RIDER = "Backup rider · Hoa (veteran, demo fixture)";

export function shiftById(id: string): Shift {
  const s = fixtures.shifts.find((x) => x.id === id);
  if (!s) throw new Error(`Unknown shift ${id}`);
  return s;
}
