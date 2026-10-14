// Domain types for the S-Compass prototype.

export type LocationType = "school" | "office" | "industrial" | "gated_facility";
export type Block = "morning" | "afternoon" | "evening";
export type DayType = "weekday" | "weekend";
export type Payment = "cod" | "prepaid";
export type Parcel = "standard" | "bulky" | "fragile" | "documents";
export type Point = [number, number]; // local metres (de-identified)

export type PlanMethod = "baseline" | "rules" | "model";

export type CardStatus = "unverified" | "suggested" | "verified" | "disputed";

export interface NoteCount {
  text: string;
  count: number;
}

export interface WindowRestriction extends NoteCount {
  code: "office_hours" | "lunch_only" | "after_17" | "no_evening" | "closed_weekend" | "lunch_break";
  blocks?: Block[];
  latest?: string;
  weekdaysOnly?: boolean;
  info?: boolean;
}

export interface KnowledgeRecord {
  key: string;
  name: string;
  type: LocationType;
  visits: number;
  firstAttemptSuccess: number;
  entranceCandidate: Point | null;
  pinSpreadMeters: number | null;
  pinMissingShare: number;
  serviceMinutesMedian: number | null;
  entranceNotes: NoteCount[];
  handoverNotes: NoteCount[];
  accessNotes: NoteCount[];
  windowNotes: NoteCount[];
  windowRestrictions: WindowRestriction[];
  pastIssues: NoteCount[];
  windowHistory: Record<string, { attempts: number; delivered: number }>;
  evidence: string;
}

export interface FixtureStop {
  id: string;
  receivedOrder: number;
  buyer: string;
  locationKey: string;
  locationType: LocationType;
  payment: Payment;
  parcel: Parcel;
  pin: Point | null;
  serviceMinutes: number | null;
  isReattempt: boolean;
}

export interface Shift {
  id: string;
  date: string;
  weekday: string;
  isWeekend: boolean;
  zoneLabel: string;
  stops: FixtureStop[];
  actualDatasetOutcome: {
    attempts: number;
    delivered: number;
    byWindow: Record<Block, { attempts: number; delivered: number }>;
  };
}

/** A restriction the planner must respect (verified) or should prefer (suggested). */
export interface ActiveRestriction {
  code: WindowRestriction["code"] | "temporary_closure";
  text: string;
  strength: "hard" | "soft";
  blocks?: Block[];
  latestMin?: number;
  earliestMin?: number;
  weekdaysOnly?: boolean;
  source: string;
}

/** The knowledge card as the app currently sees it (dataset record + session changes). */
export interface StopCard {
  key: string;
  name: string;
  type: LocationType;
  status: CardStatus;
  entrance: string;
  entrancePoint: Point | null;
  entranceSource: string;
  alternateEntrance: string | null;
  handover: string;
  access: string[];
  receivingWindows: string[];
  restrictions: ActiveRestriction[];
  serviceMinutes: number | null;
  source: string;
  lastVerified: string | null;
  verifiedBy: string | null;
  pinSpreadMeters: number | null;
  pastIssues: NoteCount[];
  windowHistory: Record<string, { attempts: number; delivered: number }>;
  visits: number;
  temporaryClosure: { text: string; untilMin: number | null; useAlternate: boolean } | null;
}

export type BuyerResponse =
  | { kind: "none" }
  | { kind: "invited"; offeredBlock: Block; at: string }
  | { kind: "confirmed"; block: Block; at: string }
  | { kind: "changed"; block: Block; previous: Block | null; at: string }
  | { kind: "pickup"; pickupId: string; at: string }
  | { kind: "no_response"; at: string };

export type StopStatus = "pending" | "delivered" | "failed" | "transferred";

export interface StopState {
  status: StopStatus;
  outcomeReason?: string;
  completedAtMin?: number;
  buyer: BuyerResponse;
  transferredTo?: string;
}

export interface PlannedStop {
  stopId: string;
  seq: number;
  block: Block;
  arriveMin: number;
  departMin: number;
  travelMin: number;
  serviceMin: number;
  searchMin: number;
  distanceM: number;
  point: Point | null;
  pointSource: "verified entrance" | "suggested entrance" | "map pin" | "pickup point" | "no location";
  p: number | null; // history-table estimate (same scorer for every method)
  pModel: number | null; // model estimate (model method only)
  reasons: string[];
  flags: string[];
  fixed: boolean; // completed before this plan was made
}

export interface PlanTotals {
  stops: number;
  expectedSuccess: number;
  estimatedStops: number;
  distanceKm: number;
  onRoadMin: number;
  endMin: number;
  evening: number;
  lowChance: number;
  flagged: number;
  confirmedKept: number;
  confirmedTotal: number;
}

export interface Plan {
  id: string;
  method: PlanMethod;
  createdAt: string;
  shiftId: string;
  startMin: number;
  stops: PlannedStop[];
  totals: PlanTotals;
  warnings: string[];
  computeMs: number;
}

export interface PickupPoint {
  id: string;
  name: string;
  pos: Point;
  hours: string;
}
