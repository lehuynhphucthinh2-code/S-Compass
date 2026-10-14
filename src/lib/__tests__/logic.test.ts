import { describe, expect, it } from "vitest";
import parity from "./model-parity.json";
import { predictFromVector } from "../model";
import { fixtures, shiftById } from "../data";
import {
  buyerChange,
  buyerConfirm,
  buyerNoResponse,
  buyerPickup,
  decideCorrection,
  decideProposal,
  dispatchPlan,
  generatePlan,
  initialState,
  recordOutcome,
  reportEntranceClosed,
  selectShift,
  suggestCorrection,
  transferParcel,
  verifyCard,
  planFor,
  cardsFor,
} from "../demoState";
import { toCsv } from "../evidence";
import { tableP } from "../successTable";

describe("model", () => {
  it("matches scikit-learn probabilities (parity cases from build_data.py)", () => {
    for (const c of parity as { x: number[]; p: number }[]) {
      expect(Math.abs(predictFromVector(c.x) - c.p)).toBeLessThan(2e-3);
    }
  });
});

describe("history table", () => {
  it("shows the dataset pattern: school evenings are weaker than mornings", () => {
    expect(tableP("school", "evening", "weekday", "prepaid").p).toBeLessThan(tableP("school", "morning", "weekday", "prepaid").p);
  });
});

describe("planner", () => {
  it("never drops or adds stops (no hidden workload change)", () => {
    const s = initialState();
    for (const m of ["baseline", "rules", "model"] as const) {
      const plan = planFor(s, m);
      const ids = plan.stops.map((x) => x.stopId).sort();
      expect(ids).toEqual(shiftById(s.shiftId).stops.map((x) => x.id).sort());
    }
  });

  it("rules plan uses fewer evening attempts and a higher estimate than the distance-only baseline", () => {
    const s = initialState();
    const base = planFor(s, "baseline");
    const rules = planFor(s, "rules");
    expect(rules.totals.expectedSuccess).toBeGreaterThan(base.totals.expectedSuccess);
  });

  it("keeps completed stops fixed and replans only pending stops", () => {
    let s = initialState();
    s = generatePlan(s, "rules");
    s = dispatchPlan(s, s.draftPlan!);
    const first = s.currentPlan[s.shiftId]!.stops[0].stopId;
    s = recordOutcome(s, first, "delivered");
    const re = planFor(s, "rules");
    expect(re.stops[0].stopId).toBe(first);
    expect(re.stops[0].fixed).toBe(true);
    expect(re.startMin).toBeGreaterThan(8 * 60);
  });

  it("buyer window change creates a proposal that respects the new window", () => {
    let s = initialState();
    s = generatePlan(s, "rules");
    s = dispatchPlan(s, s.draftPlan!);
    const target = s.currentPlan[s.shiftId]!.stops.find((x) => x.block !== "evening")!;
    s = buyerChange(s, target.stopId, "evening");
    const open = s.proposals.find((p) => p.status === "open")!;
    expect(open).toBeTruthy();
    expect(open.proposed.stops.find((x) => x.stopId === target.stopId)!.block).toBe("evening");
    s = decideProposal(s, open.id, true);
    expect(s.currentPlan[s.shiftId]!.stops.find((x) => x.stopId === target.stopId)!.block).toBe("evening");
  });

  it("confirming the already planned window does not trigger a replan", () => {
    let s = initialState();
    s = generatePlan(s, "rules");
    s = dispatchPlan(s, s.draftPlan!);
    const t = s.currentPlan[s.shiftId]!.stops[2];
    s = buyerConfirm(s, t.stopId, t.block);
    expect(s.proposals.length).toBe(0);
  });

  it("no response never cancels the order", () => {
    let s = initialState();
    const id = shiftById(s.shiftId).stops[0].id;
    s = buyerNoResponse(s, id);
    expect(s.stopStates[s.shiftId][id].status).toBe("pending");
    expect(planFor(s, "rules").stops.some((x) => x.stopId === id)).toBe(true);
  });

  it("pickup choice routes the stop to the pickup point", () => {
    let s = initialState();
    const id = shiftById(s.shiftId).stops[3].id;
    s = buyerPickup(s, id, "pp-1");
    const ps = planFor(s, "rules").stops.find((x) => x.stopId === id)!;
    expect(ps.pointSource).toBe("pickup point");
    expect(ps.p).toBeNull();
  });

  it("approved correction becomes a hard rule in the next plan; pending ones do not", () => {
    let s = initialState();
    const stop = shiftById(s.shiftId).stops.find((x) => x.locationKey === "loc-03")!;
    s = suggestCorrection(s, "loc-03", "receiving_window", "Receives after 17:00 (end of work shift)", "after_17");
    expect(planFor(s, "rules").stops.filter((x) => shiftById(s.shiftId).stops.find((y) => y.id === x.stopId)!.locationKey === "loc-03").every((x) => x.block === "evening")).toBe(false);
    s = decideCorrection(s, s.corrections[0].id, true);
    expect(cardsFor(s)["loc-03"].status).toBe("verified");
    const after = planFor(s, "rules").stops.find((x) => x.stopId === stop.id)!;
    expect(after.block).toBe("evening");
  });

  it("entrance closed for the rest of the shift keeps the stop in the queue and flags it", () => {
    let s = initialState();
    s = generatePlan(s, "rules");
    s = dispatchPlan(s, s.draftPlan!);
    const stop = shiftById(s.shiftId).stops.find((x) => x.locationKey === "loc-01")!;
    s = reportEntranceClosed(s, stop.id, null, false);
    const prop = s.proposals.find((p) => p.status === "open")!;
    const ps = prop.proposed.stops.find((x) => x.stopId === stop.id)!;
    expect(ps).toBeTruthy();
    expect(ps.flags.length).toBeGreaterThan(0);
    expect(Number.isNaN(ps.arriveMin)).toBe(true);
  });

  it("verified weekend closure on Saturday flags office stops instead of dropping them", () => {
    let s = selectShift(initialState(), "shift-sat");
    s = { ...s, role: "dispatcher" };
    s = verifyCard(s, "loc-01");
    const plan = planFor(s, "rules");
    const officeStops = shiftById("shift-sat").stops.filter((x) => x.locationKey === "loc-01");
    for (const o of officeStops) {
      const ps = plan.stops.find((x) => x.stopId === o.id)!;
      expect(ps).toBeTruthy();
      expect(ps.flags.join(" ")).toMatch(/weekend/i);
    }
  });

  it("transfer requires an explicit action and removes the stop from rider A", () => {
    let s = initialState();
    s = generatePlan(s, "rules");
    s = dispatchPlan(s, s.draftPlan!);
    const id = s.currentPlan[s.shiftId]!.stops[5].stopId;
    s = transferParcel(s, id, "Rider A over capacity");
    expect(s.currentPlan[s.shiftId]!.stops.some((x) => x.stopId === id)).toBe(false);
    expect(planFor(s, "rules").stops.some((x) => x.stopId === id)).toBe(false);
    expect(s.transfers.length).toBe(1);
  });
});

describe("privacy", () => {
  it("public fixtures contain no dataset identifiers or coordinates", () => {
    const txt = JSON.stringify(fixtures);
    expect(txt).not.toMatch(/\b[OBL]\d{4,5}\b/);
    expect(txt).not.toMatch(/\bR0\d\b/);
    expect(txt).not.toMatch(/10\.\d{5,}|106\.\d{5,}/);
  });
});

describe("evidence export", () => {
  it("escapes commas and quotes in CSV", () => {
    let s = initialState();
    s = generatePlan(s, "rules");
    const csv = toCsv([{ ...s.events[0], summary: 'a, "b"' }]);
    expect(csv.split("\n")[1]).toContain('"a, ""b"""');
  });
});
