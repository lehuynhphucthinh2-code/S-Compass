"use client";

import { ArrowLeftRight, ArrowRight, BarChart3, Check, Clock, FileUp, Info, Package, Send, Sparkles, Target, TriangleAlert } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { BlockTag, CardStatusBadge, ChanceText, EmptyState, MethodBadge, SourceTag, Stat, TYPE_LABEL } from "@/components/bits";
import { RouteMap } from "@/components/RouteMap";
import { ShiftRibbon } from "@/components/ShiftRibbon";
import { StopCardDialog } from "@/components/StopCardDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { Label, Textarea } from "@/components/ui/field";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { BACKUP_RIDER, activeImportBatch, fixtures, historical, riderOfShift } from "@/lib/data";
import { comparePlans, dispatchPlan, generatePlan, selectRider, selectShift, transferParcel } from "@/lib/demoState";
import { metrics } from "@/lib/evidence";
import { METHOD_LABEL } from "@/lib/planner";
import { explainTable } from "@/lib/successTable";
import { SHIFT_START, blockLabel, fmt } from "@/lib/time";
import type { FixtureStop, Plan, PlanMethod, PlannedStop } from "@/lib/types";
import { cn, pct } from "@/lib/utils";
import { useDemo } from "@/state/DemoProvider";
import { CountUp, Details, Hint, usePresent } from "@/state/PresentMode";

type Filter = "all" | "pending" | "risk" | "done";

export default function DispatcherPage() {
  const { state, update, shift, cards, plan } = useDemo();
  const { present } = usePresent();
  const [filter, setFilter] = React.useState<Filter>("all");
  const [cardOpen, setCardOpen] = React.useState<{ key: string; stopId: string } | null>(null);
  const [compareOpen, setCompareOpen] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  React.useEffect(() => {
    if (!sent) return;
    const t = setTimeout(() => setSent(false), 3500);
    return () => clearTimeout(t);
  }, [sent]);
  const [transferStop, setTransferStop] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<string | null>(null);

  const rider = riderOfShift(shift);
  const draft = state.draftPlan && state.draftPlan.shiftId === shift.id ? state.draftPlan : null;
  const shown: Plan | null = draft ?? plan;
  const states = state.stopStates[shift.id];
  const stopById = Object.fromEntries(shift.stops.map((s) => [s.id, s]));

  const rows: (PlannedStop | null)[] = shown ? shown.stops : shift.stops.map(() => null);
  const isRisk = (ps: PlannedStop) => states[ps.stopId]?.status === "pending" && (ps.flags.length > 0 || (ps.p !== null && ps.p < 0.65));
  const pendingCount = shift.stops.filter((s) => states[s.id].status === "pending").length;
  const riskCount = shown ? shown.stops.filter(isRisk).length : 0;
  const doneCount = shift.stops.filter((s) => ["delivered", "failed"].includes(states[s.id].status)).length;
  const transferred = state.transfers.filter((t) => t.shiftId === shift.id);
  const m = metrics(state.events);
  const pendingCorrections = state.corrections.filter((c) => c.status === "pending");
  const openProposal = state.proposals.find((p) => p.status === "open" && p.previous.shiftId === shift.id);

  const shownRows = shown
    ? shown.stops.filter((ps) => {
        const st = states[ps.stopId]?.status;
        if (filter === "pending") return st === "pending";
        if (filter === "done") return st === "delivered" || st === "failed";
        if (filter === "risk") return isRisk(ps);
        return true;
      })
    : [];

  const setMethod = (m: PlanMethod) => update((s) => ({ ...s, method: m }));
  const compared = !!state.comparison && state.comparison[0]?.shiftId === shift.id;

  return (
    <div className="space-y-5">
      <DataSourceBar imported={shift.id.startsWith("imp-")} shiftDate={shift.date} weekday={shift.weekday} parcels={shift.stops.length} />
      <StartHere generated={!!shown} compared={compared} dispatched={!!plan} />
      {/* Shift and planning controls */}
      <Panel>
        <div className="flex flex-wrap items-end gap-4 px-4 py-4">
          <div>
            <label htmlFor="rider" className="text-xs text-ink-faint">
              Rider
            </label>
            <select
              id="rider"
              className="mt-1 block h-10 rounded-lg border border-line bg-surface px-3 text-sm font-medium"
              value={rider.id}
              onChange={(e) => update((s) => selectRider(s, e.target.value))}
            >
              {fixtures.riders.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label} · {r.zoneLabel} ({r.locations} sites)
                </option>
              ))}
            </select>
            {present ? null : <div className="mt-1 text-xs text-ink-faint">Demo persona: new rider. Tenure is not in the dataset.</div>}
          </div>
          <div>
            <label htmlFor="shift" className="text-xs text-ink-faint">
              Demo shift
            </label>
            <select
              id="shift"
              className="mt-1 block h-10 rounded-lg border border-line bg-surface px-3 text-sm font-medium"
              value={shift.id}
              onChange={(e) => update((s) => selectShift(s, e.target.value))}
            >
              {rider.shiftIds.map((id) => {
                const s = fixtures.shifts.find((x) => x.id === id)!;
                return (
                  <option key={s.id} value={s.id}>
                    {s.weekday} {s.date} · {s.stops.length} parcels
                  </option>
                );
              })}
            </select>
            <div className={cn("mt-1 text-xs text-ink-faint", present && "hidden")}>{shift.id.startsWith("imp-") ? "A rider-day from the imported file (see Data intake)" : "A real rider-day from the dataset, de-identified"}</div>
          </div>
          <div className="text-sm" role="group" aria-label="Planning method">
            <div className="flex items-center gap-1 text-xs text-ink-faint">
              Planning method <Hint text="Today’s app = nearest map pin next (our Baseline). S-Compass = each stop in its best time block, using the AI scorer and site rules (Rules-based). AI model (test) = same rules, but an experimental learned model picks the block." />
            </div>
            <div className="mt-1 inline-flex rounded-lg border border-line p-0.5">
              {(["baseline", "rules", "model"] as PlanMethod[]).map((mm) => (
                <button
                  key={mm}
                  type="button"
                  aria-pressed={state.method === mm}
                  onClick={() => setMethod(mm)}
                  className={cn("rounded-md px-3 py-1.5 text-sm", state.method === mm ? "bg-ink text-white" : "text-ink-soft hover:text-ink")}
                >
                  {mm === "baseline" ? "Today’s app" : mm === "rules" ? "S-Compass" : "AI model (test)"}
                </button>
              ))}
            </div>
          </div>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => update((s) => generatePlan(s, s.method))}>
              <Sparkles /> Generate plan
            </Button>
            <Button
              onClick={() => {
                update((s) => comparePlans(s));
                setCompareOpen(true);
              }}
            >
              <BarChart3 /> Compare plans
            </Button>
            {draft ? (
              <Button
                variant="dark"
                onClick={() => {
                  update((s) => dispatchPlan(s, draft));
                  setSent(true);
                }}
              >
                <Send /> Dispatch to rider
              </Button>
            ) : sent ? (
              <span role="status" className="sc-pop inline-flex h-10 items-center gap-2 rounded-lg bg-ok-tint px-3 text-sm font-semibold text-ok">
                <Check className="size-4" /> Sent to rider
              </span>
            ) : null}
          </div>
        </div>
        <p className="border-t border-line px-4 py-2 text-xs text-ink-faint">
          {present ? (
            <>
              {state.method === "baseline" && "Today’s app: nearest map pin next. It does not know when places can receive."}
              {state.method === "rules" && "S-Compass: each stop goes to the time block with the best chance, then site rules and capacity are checked."}
              {state.method === "model" && "AI model (test): same rules, but a learned model picks the time block. Shown as a test only."}
            </>
          ) : (
            <>
              {state.method === "baseline" && "Baseline copies today's routing app: nearest map pin next, no receiving windows or site notes."}
              {state.method === "rules" &&
                "Rules-based planner: picks each stop's delivery block using the AI scorer's chances (the history table learned from the dataset), applies verified site rules and buyer confirmations, checks block time capacity, then orders stops by distance."}
              {state.method === "model" &&
                "Model-assisted planner: same constraints, but block choice uses a logistic-regression success model. On the October holdout it did not beat the history table, so it is shown as an experiment."}
            </>
          )}{" "}
          <Link href="/how-it-works" className="text-info underline underline-offset-2">
            How it works
          </Link>
        </p>
      </Panel>

      {present ? <Glance shown={shown} parcels={shift.stops.length} risk={riskCount} draft={!!draft} /> : null}

      {/* Three separate evidence groups — never mixed into one KPI */}
      <Details label="Show dataset history, estimates and live activity">
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel>
          <PanelHeader title="Dataset history" note={`${historical.orders.toLocaleString()} orders, ${historical.period.from} to ${historical.period.to}`} actions={<SourceTag kind="dataset" />} />
          <div className="grid grid-cols-2 gap-4 px-4 py-3">
            <Stat label="First-attempt success" value={pct(historical.kpis.firstAttemptSuccess, 1)} sub={`Case target ${pct(historical.caseTargets.firstAttemptSuccess)}`} />
            <Stat label="Re-delivery rate" value={pct(historical.kpis.redeliveryRate, 1)} sub={`Case target ${pct(historical.caseTargets.redeliveryRate, 1)}`} />
            <Stat
              label="Evening vs morning success"
              value={`${pct(historical.byWindow.find((w) => w.attempt_time === "evening")!.success)} vs ${pct(historical.byWindow.find((w) => w.attempt_time === "morning")!.success)}`}
              sub="first attempts"
            />
            {shift.id.startsWith("imp-") ? (
              <Stat label="This rider-day in the file" value={shift.actualDatasetOutcome.attempts ? `${shift.actualDatasetOutcome.delivered} / ${shift.actualDatasetOutcome.attempts}` : "—"} sub={shift.actualDatasetOutcome.attempts ? "attempts delivered (from the file)" : "no outcomes in the file"} />
            ) : (
              <Stat label="This rider-day in the dataset" value={`${shift.actualDatasetOutcome.delivered} / ${shift.actualDatasetOutcome.attempts}`} sub="attempts delivered (actual)" />
            )}
          </div>
        </Panel>
        <Panel>
          <PanelHeader
            title={shown ? (draft ? "Draft plan estimate" : "Dispatched plan estimate") : "Plan estimate"}
            note={shown ? METHOD_LABEL[shown.method] : "Generate a plan to see estimates"}
            actions={<SourceTag kind="simulated" />}
          />
          {shown ? (
            <div className="grid grid-cols-2 gap-4 px-4 py-3">
              <Stat label="Expected successful deliveries" value={shown.totals.expectedSuccess.toFixed(1)} sub={`of ${shown.totals.estimatedStops} estimated remaining stops`} />
              <Stat label="Estimated finish" value={fmt(shown.totals.endMin)} sub={`${Math.round(shown.totals.onRoadMin)} min working, ${shown.totals.distanceKm.toFixed(1)} km`} />
              <Stat label="Low-chance stops" value={shown.totals.lowChance} sub="planned where history shows under 65%" />
              <Stat label="Flagged for dispatcher" value={shown.totals.flagged} sub={shown.totals.confirmedTotal ? `${shown.totals.confirmedKept}/${shown.totals.confirmedTotal} buyer windows kept` : "no buyer confirmations yet"} />
            </div>
          ) : (
            <p className="px-4 py-6 text-sm text-ink-faint">No plan yet. Choose a method and select Generate plan.</p>
          )}
        </Panel>
        <Panel>
          <PanelHeader title="Live demo activity" note="Actions taken in this browser session" actions={<SourceTag kind="live" />} />
          <div className="grid grid-cols-2 gap-4 px-4 py-3">
            <Stat label="Stops completed" value={`${doneCount} / ${shift.stops.length}`} sub={`${shift.stops.filter((s) => states[s.id].status === "delivered").length} delivered, ${shift.stops.filter((s) => states[s.id].status === "failed").length} failed`} />
            <Stat label="Buyer replies" value={m.buyerAnswered} sub={`${m.buyerNoResponse} no response`} />
            <Stat label="Corrections" value={`${m.correctionsApproved} approved`} sub={`${pendingCorrections.length} waiting`} />
            <Stat label="Plan changes" value={`${m.replansAccepted} accepted`} sub={`${m.replansOverridden} overridden`} />
          </div>
        </Panel>
      </div>
      </Details>

      {openProposal || pendingCorrections.length ? (
        <div className="flex flex-wrap gap-3">
          {openProposal ? (
            <Link href="/replan" className="flex items-center gap-2 rounded-lg border border-brand/40 bg-brand-tint px-3 py-2 text-sm text-brand-ink">
              <TriangleAlert className="size-4" /> Plan change waiting: {openProposal.triggerText}
            </Link>
          ) : null}
          {pendingCorrections.length ? (
            <Link href="/stops" className="flex items-center gap-2 rounded-lg border border-warn/40 bg-warn-tint px-3 py-2 text-sm text-warn">
              <Info className="size-4" /> {pendingCorrections.length} stop-card correction(s) waiting for review
            </Link>
          ) : null}
        </div>
      ) : null}

      <Panel>
            <PanelHeader title="Shift timeline" note={present ? "One bar per stop, by time of day" : "Each bar is a stop: it starts at its simulated arrival and lasts as long as the handover"} actions={<SourceTag kind="simulated" />} />
            <div className="px-4 py-3">
              {shown ? (
                <ShiftRibbon plan={shown} states={states} clockMin={plan ? state.clockMin[shift.id] : undefined} onSelect={setSelected} selected={selected} />
              ) : (
                <p className="text-sm text-ink-faint">Appears after you generate a plan.</p>
              )}
            </div>
          </Panel>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Panel>
          <PanelHeader
            title="Deliveries"
            note={
              shown
                ? `${shown.stops.length} assigned · ${pendingCount} pending · ${riskCount} at risk${transferred.length ? ` · ${transferred.length} moved to the backup rider` : ""}`
                : `${shift.stops.length} parcels loaded, in the order they were received`
            }
            actions={
              shown ? (
                <div className="flex items-center gap-2">
                  <MethodBadge method={shown.method} />
                  {draft ? <Badge tone="brand">Draft, not dispatched</Badge> : <Badge tone="ok">Dispatched</Badge>}
                </div>
              ) : null
            }
          />
          {shown ? (
            <>
              <div className="flex gap-1 border-b border-line px-3 py-2" role="tablist" aria-label="Filter deliveries">
                {(["all", "pending", "risk", "done"] as Filter[]).map((f) => (
                  <button
                    key={f}
                    role="tab"
                    aria-selected={filter === f}
                    onClick={() => setFilter(f)}
                    className={cn("rounded-md px-2.5 py-1 text-sm", filter === f ? "bg-canvas font-medium text-ink" : "text-ink-soft hover:text-ink")}
                  >
                    {f === "all" ? "All" : f === "pending" ? "Pending" : f === "risk" ? `At risk (${riskCount})` : "Done"}
                  </button>
                ))}
              </div>
              <div className="max-h-[760px] overflow-auto">
                <table className={cn("w-full text-sm", present ? "min-w-[620px]" : "min-w-[820px]")}>
                  <thead className="sticky top-0 z-[1] bg-surface text-left text-xs text-ink-faint">
                    <tr className="border-b border-line">
                      <th className="px-3 py-2 font-normal">#</th>
                      <th className="px-3 py-2 font-normal">Parcel</th>
                      <th className="px-3 py-2 font-normal">{present ? "Place" : "Location"}</th>
                      {present ? null : <th className="px-3 py-2 font-normal">Payment</th>}
                      <th className="px-3 py-2 font-normal">{present ? "Time" : "Block and ETA"}</th>
                      <th className="px-3 py-2 font-normal">Chance</th>
                      {present ? null : <th className="px-3 py-2 font-normal">Knowledge</th>}
                      <th className="px-3 py-2 font-normal">Status</th>
                      <th className="px-3 py-2 font-normal">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {shownRows.map((ps) => {
                      const st = stopById[ps.stopId];
                      const card = cards[st.locationKey];
                      const ss = states[ps.stopId];
                      const buyer = ss.buyer;
                      return (
                        <tr
                          key={ps.stopId}
                          className={cn("border-b border-line/70 align-top transition-colors duration-300 hover:bg-canvas/60", selected === ps.stopId && "bg-brand-tint/60 shadow-[inset_3px_0_0_0_#ee4d2d]")}
                          onClick={() => setSelected(ps.stopId)}
                        >
                          <td className="px-3 py-2.5 text-ink-faint">{ps.seq}</td>
                          <td className="px-3 py-2.5">
                            <div className="font-medium">{ps.stopId}</div>
                            {present ? null : <div className="text-xs text-ink-faint">{st.buyer}</div>}
                            {st.isReattempt ? <div className="text-xs text-warn">Re-attempt</div> : null}
                          </td>
                          <td className="px-3 py-2.5">
                            <button
                              className="text-left font-medium text-info underline-offset-2 hover:underline"
                              onClick={(e) => {
                                e.stopPropagation();
                                setCardOpen({ key: st.locationKey, stopId: ps.stopId });
                              }}
                            >
                              {card.name}
                            </button>
                            <div className="text-xs text-ink-faint">
                              {TYPE_LABEL[st.locationType]}
                              {present ? (st.payment === "cod" ? " · COD" : "") : ` · ${st.parcel}`}
                              {!st.pin ? " · no map pin" : ""}
                            </div>
                          </td>
                          {present ? null : <td className="px-3 py-2.5">{st.payment === "cod" ? <Badge tone="warn">COD</Badge> : <span className="text-ink-soft">Prepaid</span>}</td>}
                          <td className="px-3 py-2.5">
                            {Number.isNaN(ps.arriveMin) ? <span className="text-bad">Not scheduled</span> : <BlockTag block={ps.block} eta={ps.arriveMin} />}
                            {buyer.kind === "confirmed" || buyer.kind === "changed" ? <div className="text-xs text-ok">Buyer confirmed</div> : null}
                            {buyer.kind === "pickup" ? <div className="text-xs text-info">Pickup point</div> : null}
                            {buyer.kind === "invited" ? <div className="text-xs text-warn">Waiting for buyer</div> : null}
                            {buyer.kind === "no_response" ? <div className="text-xs text-ink-faint">No buyer reply</div> : null}
                          </td>
                          <td className="px-3 py-2.5">
                            <ChanceText p={ps.p} />
                          </td>
                          {present ? null : (
                            <td className="px-3 py-2.5">
                              <CardStatusBadge status={card.status} />
                            </td>
                          )}
                          <td className="px-3 py-2.5">
                            {ss.status === "pending" ? (
                              ps.flags.length ? (
                                <span className="text-xs text-bad" title={ps.flags.join("\n")}>
                                  {ps.flags[0]}
                                </span>
                              ) : (
                                <span className="text-xs text-ink-soft">Pending</span>
                              )
                            ) : (
                              <Badge tone={ss.status === "delivered" ? "ok" : "bad"}>{ss.status}</Badge>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            {ss.status === "pending" && !draft && plan ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setTransferStop(ps.stopId);
                                }}
                                title="Move this parcel to the backup rider (explicit dispatcher action)"
                              >
                                <ArrowLeftRight /> Move
                              </Button>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {shownRows.length === 0 ? <p className="px-4 py-6 text-sm text-ink-faint">No deliveries match this filter.</p> : null}
              </div>
              {shown.warnings.length ? (
                <ul className="space-y-1 border-t border-line px-4 py-3 text-sm text-bad">
                  {shown.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              ) : null}
            </>
          ) : (
            <div className="p-4">
              <EmptyState
                title="No plan for this shift yet"
                action={
                  <Button variant="primary" onClick={() => update((s) => generatePlan(s, s.method))}>
                    <Sparkles /> Generate plan
                  </Button>
                }
              >
                {shift.stops.length} parcels are loaded for {rider.label}. Generate a plan, compare the three methods, then dispatch one to the rider.
              </EmptyState>
              <ul className={cn("mt-4 grid gap-1 text-sm sm:grid-cols-2", present && "hidden")}>
                {shift.stops.map((s) => (
                  <li key={s.id} className="flex items-center justify-between rounded-md px-2 py-1 hover:bg-canvas">
                    <button className="text-left" onClick={() => setCardOpen({ key: s.locationKey, stopId: s.id })}>
                      <span className="font-medium">{s.id}</span> <span className="text-ink-soft">{cards[s.locationKey].name}</span>
                    </button>
                    <span className="text-xs text-ink-faint">
                      {TYPE_LABEL[s.locationType]} · {s.payment.toUpperCase()}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Panel>

        <div className="space-y-5">
          <Panel>
            <PanelHeader title="Route" note={present ? undefined : "Click a stop to highlight it in the list"} />
            <div className="px-4 py-3">
              <RouteMap riderId={rider.id} plan={shown} states={states} selected={selected} onSelect={setSelected} baseline={compared ? state.comparison?.find((p) => p.method === "baseline") : null} />
            </div>
          </Panel>
          {selected && shown ? <SelectedStop ps={shown.stops.find((x) => x.stopId === selected)} stop={stopById[selected]} weekend={shift.isWeekend} method={shown.method} imported={shift.id.startsWith("imp-")} onOpen={() => setCardOpen({ key: stopById[selected].locationKey, stopId: selected })} /> : null}
          {transferred.length ? (
            <Panel>
              <PanelHeader title={BACKUP_RIDER} note="Parcels moved here by the dispatcher" />
              <ul className="space-y-1 px-4 py-3 text-sm">
                {transferred.map((t) => (
                  <li key={t.stopId}>
                    <span className="font-medium">{t.stopId}</span> — {t.note} <span className="text-xs text-ink-faint">({new Date(t.at).toLocaleTimeString()})</span>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}
        </div>
      </div>

      <StopCardDialog cardKey={cardOpen?.key ?? null} stopId={cardOpen?.stopId} open={!!cardOpen} onOpenChange={(o) => !o && setCardOpen(null)} from="dispatcher list" />
      <CompareDialog open={compareOpen} onOpenChange={setCompareOpen} />
      <TransferDialog stopId={transferStop} riderName={rider.label} onClose={() => setTransferStop(null)} onConfirm={(note) => transferStop && update((s) => transferParcel(s, transferStop, note))} />
    </div>
  );
}

function SelectedStop({ ps, stop, weekend, method, imported, onOpen }: { ps?: PlannedStop; stop?: FixtureStop; weekend: boolean; method: PlanMethod; imported: boolean; onOpen: () => void }) {
  if (!ps) return null;
  return (
    <Panel>
      <PanelHeader title={`Why ${ps.stopId} is planned here`} actions={<Button size="sm" onClick={onOpen}>Open stop card</Button>} />
      <div className="space-y-2 px-4 py-3 text-sm">
        <p>
          <BlockTag block={ps.block} eta={ps.arriveMin} /> · going to the <span className="font-medium">{ps.pointSource}</span>
        </p>
        <ul className="list-disc space-y-1 pl-5 text-ink-soft">
          {ps.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
        {ps.flags.length ? (
          <ul className="space-y-1 text-bad">
            {ps.flags.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        ) : null}
        <p className="text-xs text-ink-faint">
          Simulated: travel {Math.round(ps.travelMin)} min, entrance search {ps.searchMin} min, service {ps.serviceMin} min.
        </p>
        {stop ? <EstimateExplain ps={ps} stop={stop} weekend={weekend} method={method} imported={imported} /> : null}
      </div>
    </Panel>
  );
}

function CompareDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { state, update } = useDemo();
  const { present } = usePresent();
  const plans = state.comparison ?? [];
  const best = plans.length ? Math.max(...plans.map((p) => p.totals.expectedSuccess)) : 0;
  const rows: { label: string; get: (p: Plan) => string; note?: string }[] = [
    { label: "Expected successful deliveries", get: (p) => p.totals.expectedSuccess.toFixed(1), note: "History-table estimate, same scorer for every method" },
    { label: "Stops with an estimate", get: (p) => `${p.totals.estimatedStops} / ${p.totals.stops}` },
    { label: "Stops in a block with under 65% chance", get: (p) => String(p.totals.lowChance), note: "e.g. schools and offices in the evening" },
    { label: "Distance (straight-line × 1.3)", get: (p) => `${p.totals.distanceKm.toFixed(1)} km` },
    { label: "Working time (travel + search + service)", get: (p) => `${Math.round(p.totals.onRoadMin)} min` },
    { label: "Estimated finish", get: (p) => fmt(p.totals.endMin) },
    { label: "Stops flagged for dispatcher", get: (p) => String(p.totals.flagged) },
    { label: "Buyer-confirmed windows kept", get: (p) => (p.totals.confirmedTotal ? `${p.totals.confirmedKept} / ${p.totals.confirmedTotal}` : "none confirmed") },
    { label: "Planner run time", get: (p) => `${p.computeMs} ms` },
  ];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Compare plans" description="Same parcels, same rider, same start. All figures are simulated estimates, not measured results." wide>
        {plans.length ? (
          <>
            <CompareCards plans={plans} onUse={(p) => update((s) => ({ ...s, method: p.method, draftPlan: p }))} />
            <Details label="Show the full table (all three plans)" className="mt-4">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left">
                    <th className="py-2 pr-3 font-normal text-ink-faint">Measure</th>
                    {plans.map((p) => (
                      <th key={p.method} className="py-2 pr-3">
                        <MethodBadge method={p.method} />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.label} className="border-b border-line/70">
                      <td className="py-2 pr-3">
                        {r.label}
                        {r.note ? <div className="text-xs text-ink-faint">{r.note}</div> : null}
                      </td>
                      {plans.map((p) => (
                        <td key={p.method} className={cn("py-2 pr-3 font-medium", r.label.startsWith("Expected") && p.totals.expectedSuccess === best && "text-ok")}>
                          {r.get(p)}
                        </td>
                      ))}
                    </tr>
                  ))}
                  <tr>
                    <td className="py-3 pr-3 text-ink-faint">Use as draft</td>
                    {plans.map((p) => (
                      <td key={p.method} className="py-3 pr-3">
                        <DialogClose asChild>
                          <Button size="sm" variant={p.method === "rules" ? "primary" : "outline"} onClick={() => update((s) => ({ ...s, method: p.method, draftPlan: p }))}>
                            Use {p.method === "model" ? "model" : p.method}
                          </Button>
                        </DialogClose>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="mt-4 rounded-lg bg-canvas p-3 text-sm text-ink-soft">
              <p className="font-medium text-ink">How to read this</p>
              <p className="mt-1">
                The rules plan moves school and office stops out of the evening, where the dataset shows the weakest success, at the cost of more kilometres.
                The model plan uses the same constraints with a learned success model; on held-out October data it was not more accurate than the history table, so its
                small differences here are not evidence that AI is better. The pilot is designed to test that question.
              </p>
            </div>
            </Details>
          </>
        ) : (
          <p className="text-sm text-ink-faint">Run Compare plans to see the three methods side by side.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

function TransferDialog({ stopId, riderName, onClose, onConfirm }: { stopId: string | null; riderName: string; onClose: () => void; onConfirm: (note: string) => void }) {
  const [note, setNote] = React.useState("Rider is over capacity in the evening block");
  return (
    <Dialog open={!!stopId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={`Move ${stopId} to the backup rider?`} description={`The parcel is already loaded on ${riderName}. Moving it to ${BACKUP_RIDER} needs a physical handover, so it only happens when you confirm here.`}>
        <Label htmlFor="transfer-note">Reason (saved in the evidence log)</Label>
        <Textarea id="transfer-note" value={note} onChange={(e) => setNote(e.target.value)} />
        <div className="mt-4 flex justify-end gap-2">
          <Button onClick={onClose}>Keep with {riderName}</Button>
          <Button
            variant="primary"
            disabled={!note.trim()}
            onClick={() => {
              onConfirm(note.trim());
              onClose();
            }}
          >
            Move parcel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** The two plans that matter on stage: today's logic vs S-Compass, with three numbers each and a bar to compare them. */
function CompareCards({ plans, onUse }: { plans: Plan[]; onUse: (p: Plan) => void }) {
  const today = plans.find((p) => p.method === "baseline");
  const sc = plans.find((p) => p.method === "rules");
  const ai = plans.find((p) => p.method === "model");
  if (!today || !sc) return null;
  const late = (p: Plan) => p.totals.endMin > 20 * 60 + 30;
  const items: { label: string; a: number; b: number; format: (v: number) => string; lowerBetter: boolean; bar: (v: number, max: number) => number; gain: (a: number, b: number) => string }[] = [
    {
      label: "Expected successful deliveries",
      a: today.totals.expectedSuccess,
      b: sc.totals.expectedSuccess,
      format: (v) => v.toFixed(1),
      lowerBetter: false,
      bar: (v, max) => (max > 0 ? v / max : 0),
      gain: (a, b) => `+${(b - a).toFixed(1)} deliveries`,
    },
    {
      label: "Estimated finish",
      a: today.totals.endMin,
      b: sc.totals.endMin,
      format: (v) => fmt(Math.round(v)),
      lowerBetter: true,
      bar: (v, max) => (max > SHIFT_START ? (v - SHIFT_START) / (max - SHIFT_START) : 0),
      gain: (a, b) => `${Math.round(a - b)} min earlier`,
    },
    {
      label: "Stops at a low-chance time",
      a: today.totals.lowChance,
      b: sc.totals.lowChance,
      format: (v) => String(Math.round(v)),
      lowerBetter: true,
      bar: (v, max) => (max > 0 ? v / max : 0),
      gain: (a, b) => `${a - b} fewer`,
    },
  ];
  const isBetter = (x: (typeof items)[number]) => (x.lowerBetter ? x.b < x.a : x.b > x.a);
  const max = (x: (typeof items)[number]) => Math.max(x.a, x.b);
  return (
    <div>
      <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr] md:items-stretch">
        <div className="rounded-xl border border-line bg-canvas p-4">
          <div className="text-sm font-semibold text-ink-soft">Today’s app</div>
          <div className="text-xs text-ink-faint">Nearest map pin next</div>
          <dl className="mt-3 space-y-4">
            {items.map((x) => (
              <div key={x.label}>
                <dt className="text-xs text-ink-faint">{x.label}</dt>
                <dd className="text-3xl font-semibold text-ink-soft">{x.format(x.a)}</dd>
                <div className="mt-1 h-2 rounded-full bg-line/70">
                  <div className="sc-grow h-2 rounded-full bg-ink-faint/60" style={{ width: `${Math.max(4, x.bar(x.a, max(x)) * 100)}%` }} />
                </div>
              </div>
            ))}
          </dl>
          {late(today) ? <div className="mt-3 text-sm font-medium text-bad">Ends after the 20:30 shift end</div> : null}
        </div>
        <div className="hidden items-center md:flex">
          <ArrowRight className="size-8 text-ink-faint" aria-hidden />
        </div>
        <div className="rounded-xl border-2 border-brand bg-brand-tint/40 p-4 shadow-[0_6px_20px_-8px_rgba(238,77,45,0.35)]">
          <div className="text-sm font-semibold text-brand-ink">S-Compass</div>
          <div className="text-xs text-ink-faint">Best time block for each stop</div>
          <dl className="mt-3 space-y-4">
            {items.map((x) => (
              <div key={x.label}>
                <dt className="text-xs text-ink-faint">{x.label}</dt>
                <dd className="flex flex-wrap items-baseline gap-2 text-3xl font-semibold">
                  <CountUp from={x.a} to={x.b} format={x.format} />
                  {isBetter(x) ? <span className="sc-fade rounded-full bg-ok-tint px-2 py-0.5 text-xs font-semibold text-ok" style={{ ["--d" as string]: "0.7s" }}>{x.gain(x.a, x.b)}</span> : null}
                </dd>
                <div className="mt-1 h-2 rounded-full bg-line/70">
                  <div className={cn("sc-grow h-2 rounded-full", isBetter(x) ? "bg-brand" : "bg-ink-faint/60")} style={{ width: `${Math.max(4, x.bar(x.b, max(x)) * 100)}%` }} />
                </div>
              </div>
            ))}
          </dl>
          {late(sc) ? <div className="mt-3 text-sm font-medium text-bad">Ends after the 20:30 shift end: dispatcher review</div> : null}
          <DialogClose asChild>
            <Button variant="primary" className="mt-4 w-full" onClick={() => onUse(sc)}>
              Use the S-Compass plan
            </Button>
          </DialogClose>
        </div>
      </div>
      {ai ? (
        <p className="mt-3 text-xs text-ink-faint">
          AI model (test): {ai.totals.expectedSuccess.toFixed(1)} expected · finish {fmt(ai.totals.endMin)}. Shown as a test only; S-Compass rules stay the default.
        </p>
      ) : null}
      <p className="mt-1 text-xs text-ink-faint">{today.totals.stops === sc.totals.stops && today.totals.estimatedStops === sc.totals.estimatedStops ? `Same ${today.totals.stops} stops (${today.totals.estimatedStops} with an estimate), same scorer, same start time.` : `Today’s app: ${today.totals.stops} stops (${today.totals.estimatedStops} estimated). S-Compass: ${sc.totals.stops} stops (${sc.totals.estimatedStops} estimated).`} Bars compare the two plans on the same scale. Expected deliveries are a sum of per-stop chances, not a guaranteed result.</p>
    </div>
  );
}

/** “Start here”: the main demo path in four steps, ticked as they are done. */
function StartHere({ generated, compared, dispatched }: { generated: boolean; compared: boolean; dispatched: boolean }) {
  const steps = [
    { n: 1, text: "Pick a rider and day", done: true },
    { n: 2, text: "Generate plan", done: generated },
    { n: 3, text: "Compare with today’s app", done: compared },
    { n: 4, text: "Dispatch to rider", done: dispatched },
  ];
  const next = steps.find((x) => !x.done)?.n;
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-2 rounded-xl border border-line bg-surface px-4 py-3">
      <span className="mr-1 text-sm font-semibold">Start here</span>
      {steps.map((x, i) => (
        <React.Fragment key={x.n}>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm",
              x.done ? "bg-ok-tint text-ok" : x.n === next ? "bg-brand text-white" : "bg-canvas text-ink-faint",
            )}
          >
            {x.done ? <Check className="size-4" aria-hidden /> : <span className="font-semibold">{x.n}</span>}
            {x.text}
            {x.done ? <span className="sr-only">(done)</span> : null}
          </span>
          {i < steps.length - 1 ? <ArrowRight className="size-4 text-ink-faint" aria-hidden /> : null}
        </React.Fragment>
      ))}
      <Link href="/intake" className="ml-auto inline-flex items-center gap-1.5 text-sm text-info hover:underline">
        <FileUp className="size-4" aria-hidden /> Have an Excel or CSV file? Data intake
      </Link>
    </div>
  );
}

/** Presentation mode: the three numbers that matter, in big type. */
function Glance({ shown, parcels, risk, draft }: { shown: Plan | null; parcels: number; risk: number; draft: boolean }) {
  const late = shown ? shown.totals.endMin > 20 * 60 + 30 : false;
  const box = (accent: string, i: number) => ({ className: cn("sc-fade rounded-xl border border-line border-t-4 bg-surface px-4 py-3 shadow-[0_1px_2px_rgba(20,33,61,0.04),0_4px_14px_-6px_rgba(20,33,61,0.08)]", accent), style: { ["--d" as string]: `${i * 0.06}s` } });
  const icon = "size-4";
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <div {...box("border-t-info", 0)}>
        <div className="flex items-center gap-1.5 text-xs text-ink-faint">
          <Package className={cn(icon, "text-info")} /> Parcels today
        </div>
        <div className="text-3xl font-semibold">{parcels}</div>
      </div>
      <div {...box("border-t-brand", 1)}>
        <div className="flex items-center gap-1.5 text-xs text-ink-faint">
          <Target className={cn(icon, "text-brand")} /> Expected successes <Hint text="Sum of each stop’s chance that the attempt is delivered. An expected count from the history table, not a guaranteed or measured result." />
        </div>
        <div className="text-3xl font-semibold text-brand-ink">{shown ? shown.totals.expectedSuccess.toFixed(1) : "—"}</div>
      </div>
      <div {...box(late ? "border-t-bad" : "border-t-ok", 2)}>
        <div className="flex items-center gap-1.5 text-xs text-ink-faint">
          <Clock className={cn(icon, late ? "text-bad" : "text-ok")} /> Estimated finish
        </div>
        <div className={cn("text-3xl font-semibold", late && "text-bad")}>{shown ? fmt(shown.totals.endMin) : "—"}</div>
        {late ? <div className="text-xs font-medium text-bad">After 20:30: dispatcher review</div> : null}
      </div>
      <div {...box(risk > 0 ? "border-t-warn" : "border-t-ok", 3)}>
        <div className="flex items-center gap-1.5 text-xs text-ink-faint">
          <TriangleAlert className={cn(icon, risk > 0 ? "text-warn" : "text-ok")} /> Stops at risk <Hint text="Stops planned where history shows under 65% chance, or stops with a warning such as no map pin." />
        </div>
        <div className={cn("text-3xl font-semibold", risk > 0 && "text-warn")}>{shown ? risk : "—"}</div>
        {shown ? <div className="text-xs text-ink-faint">{draft ? "Draft plan · simulated" : "Dispatched plan · simulated"}</div> : null}
      </div>
    </div>
  );
}

/** “How this estimate is calculated”: every number below is read from the real table, nothing is invented. */
function EstimateExplain({ ps, stop, weekend, method, imported }: { ps: PlannedStop; stop: FixtureStop; weekend: boolean; method: PlanMethod; imported: boolean }) {
  const [open, setOpen] = React.useState(false);
  const day = weekend ? "weekend" : "weekday";
  const x = explainTable(stop.locationType, ps.block, day, stop.payment);
  const pct1 = (v: number) => `${(v * 100).toFixed(1)}%`;
  return (
    <div className="border-t border-line pt-2">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="text-sm font-medium text-info hover:underline">
        {open ? "Hide: how this estimate is calculated" : "How this estimate is calculated"}
      </button>
      {open ? (
        <div className="mt-2 space-y-3 text-sm">
          {ps.p === null ? (
            <p className="rounded-md bg-canvas px-3 py-2">No estimate for this stop. The buyer chose a pickup point, and the history table has no data for pickup points, so the app shows no number instead of inventing one.</p>
          ) : (
            <>
              <p className="rounded-md bg-canvas px-3 py-2">
                {imported ? "The file describes the delivery. " : ""}The app estimates success with its history table. The chance is calculated by the app{imported ? "; it is not a probability supplied in your file" : ""}.
              </p>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                <dt className="text-ink-faint">Outcome estimated</dt>
                <dd>This attempt is delivered at that time block (any attempt, first or repeat).</dd>
                <dt className="text-ink-faint">Inputs used</dt>
                <dd>
                  site type <b>{TYPE_LABEL[stop.locationType]}</b> · block <b>{blockLabel(ps.block)}</b> (chosen by the plan) · <b>{day}</b> · payment <b>{stop.payment}</b>
                </dd>
                <dt className="text-ink-faint">Where inputs come from</dt>
                <dd>{imported ? "Site type and payment: from your file (or mapped from it). Weekday/weekend: worked out from the date. Block: recommended by the plan." : "Demo records built from the Strategy Round dataset. Block: recommended by the plan."}</dd>
                <dt className="text-ink-faint">History group</dt>
                <dd>{x.found ? `${x.attempts.toLocaleString()} past attempts, about ${x.successes.toLocaleString()} delivered${x.rawRate !== null ? ` (${pct1(x.rawRate)})` : ""}. Source: ${x.trainedOn}.` : `No past attempts in this group. Fallback: the overall rate ${pct1(x.prior)}.`}</dd>
                <dt className="text-ink-faint">Formula</dt>
                <dd>
                  {x.found
                    ? `(${x.successes} + ${x.strength} × ${pct1(x.prior)}) ÷ (${x.attempts} + ${x.strength}) = ${pct1(x.p)}`
                    : `Overall rate = ${pct1(x.prior)}`}
                </dd>
                <dt className="text-ink-faint">Smoothing</dt>
                <dd>{x.strength} “pseudo-attempts” at the overall rate pull small groups toward the average, so a group with few attempts cannot look extreme.</dd>
              </dl>
              {method === "model" && ps.pModel !== null ? <p>AI model (test) value: {pct1(ps.pModel)}. It is an experimental logistic regression and did not beat this table on the holdout, so S-Compass uses the table.</p> : null}
            </>
          )}
          <ul className="list-disc space-y-1 pl-5 text-xs text-ink-faint">
            <li>The table mixes first and repeat attempts, so this is not a first-attempt probability.</li>
            <li>The number of past attempts shows how much history sits behind the estimate. It is not statistical confidence.</li>
            <li>Importing a file does not retrain or change the table. Notes written after arrival are not used as advance knowledge.</li>
            <li>The sum of these chances is an expected count of deliveries, not a guaranteed result.</li>
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/** Always says which data is on screen, so demo history is never mistaken for a file the judges brought. */
function DataSourceBar({ imported, shiftDate, weekday, parcels }: { imported: boolean; shiftDate: string; weekday: string; parcels: number }) {
  const b = activeImportBatch();
  return (
    <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border px-4 py-2 text-sm", imported ? "border-brand/40 bg-brand-tint/40" : "border-line bg-surface")}>
      <Badge tone={imported ? "ok" : "neutral"}>{imported ? "Imported data" : "Demo data"}</Badge>
      <span>
        {imported && b ? (
          <>
            <b>{b.fileName}</b>
            {b.sheet ? ` (sheet “${b.sheet}”)` : ""} · {b.purpose === "replay" ? "replay of past data" : "orders to plan"}
          </>
        ) : (
          <>Strategy Round history (1–30 Sep 2026), used as demo data. It is not data from the Final Round.</>
        )}
      </span>
      <span className="text-ink-soft">
        Batch: {weekday} {shiftDate} · {parcels} deliveries
      </span>
    </div>
  );
}
