import fixturesJson from "@/data/demo-fixtures.json";
import historicalJson from "@/data/historical-stats.json";
import tableJson from "@/data/success-table.json";
import modelJson from "@/data/model.json";
import evaluationJson from "@/data/evaluation.json";
import type { KnowledgeRecord, PickupPoint, Point, Shift } from "./types";

export const fixtures = fixturesJson as unknown as {
  hub: { name: string; pos: Point };
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

/** Fictional partner pickup points used by the Buyer Confirm simulation (demo fixtures). */
export const pickupPoints: PickupPoint[] = [
  { id: "pp-1", name: "Thu Ha Grocery (demo pickup point)", pos: [-700, 560], hours: "07:00–21:00" },
  { id: "pp-2", name: "Minh Chau Stationery (demo pickup point)", pos: [180, -720], hours: "08:00–20:00" },
];

export function shiftById(id: string): Shift {
  const s = fixtures.shifts.find((x) => x.id === id);
  if (!s) throw new Error(`Unknown shift ${id}`);
  return s;
}
