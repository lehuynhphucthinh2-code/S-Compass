"use client";

import { CheckCircle2, ChevronDown, Clock, DoorOpen, FileText, Flag, MapPin, Navigation, TriangleAlert } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { BlockTag, ChanceText, EmptyState, SourceTag, TYPE_LABEL } from "@/components/bits";
import { ProposalReview } from "@/components/ProposalReview";
import { StopCardDialog } from "@/components/StopCardDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Label, Select, Textarea } from "@/components/ui/field";
import { RIDER_A, recordOutcome, reportEntranceClosed, reportOtherIssue } from "@/lib/demoState";
import { blockInfo, fmt } from "@/lib/time";
import type { PlannedStop } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useDemo } from "@/state/DemoProvider";

const FAIL_REASONS = [
  "Buyer not available",
  "Arrived outside the site's receiving window",
  "Could not find the entrance",
  "Guard would not accept the parcel",
  "COD payment not ready",
  "Other",
];

export default function RiderPage() {
  const { state, shift, cards, plan } = useDemo();
  const [card, setCard] = React.useState<{ key: string; stopId: string } | null>(null);
  const [outcomeFor, setOutcomeFor] = React.useState<PlannedStop | null>(null);
  const [issueFor, setIssueFor] = React.useState<PlannedStop | null>(null);
  const [showDone, setShowDone] = React.useState(false);
  const states = state.stopStates[shift.id];
  const stopById = Object.fromEntries(shift.stops.map((s) => [s.id, s]));
  const proposal = state.proposals.find((p) => p.status === "open" && p.previous.shiftId === shift.id);

  if (!plan) {
    return (
      <div className="mx-auto max-w-md">
        <EmptyState title="No plan dispatched yet" action={<Link href="/dispatcher" className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white">Go to dispatcher</Link>}>
          The rider sees the route once a dispatcher generates and dispatches a plan for the {shift.weekday} shift.
        </EmptyState>
      </div>
    );
  }

  const remaining = plan.stops.filter((s) => states[s.stopId]?.status === "pending");
  const done = plan.stops.filter((s) => ["delivered", "failed"].includes(states[s.stopId]?.status));
  const next = remaining.find((s) => !Number.isNaN(s.arriveMin));
  const later = remaining.filter((s) => s !== next);
  const nextStop = next ? stopById[next.stopId] : null;
  const nextCard = nextStop ? cards[nextStop.locationKey] : null;

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold leading-6">{RIDER_A}</h1>
          <p className="text-sm text-ink-faint">
            {shift.weekday} {shift.date} · {done.length}/{plan.stops.length} done
          </p>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-1 text-lg font-semibold">
            <Clock className="size-4 text-ink-faint" /> {fmt(state.clockMin[shift.id])}
          </div>
          <div className="text-[11px] text-ink-faint">simulated clock</div>
        </div>
      </div>

      {proposal ? (
        <div className="rounded-xl border-2 border-brand bg-surface">
          <div className="rounded-t-[10px] bg-brand px-4 py-2 text-sm font-semibold text-white">Plan change proposed</div>
          <div className="p-4">
            <ProposalReview proposal={proposal} compact />
          </div>
        </div>
      ) : null}

      {next && nextStop && nextCard ? (
        <section className="overflow-hidden rounded-xl border border-line bg-surface" aria-labelledby="next-stop">
          <div className="flex items-center justify-between bg-ink px-4 py-2 text-white">
            <span id="next-stop" className="text-sm font-semibold">
              Next stop · #{next.seq}
            </span>
            <span className="text-xs opacity-80">{next.stopId}</span>
          </div>
          <div className="space-y-3 p-4">
            <div>
              <p className="text-xl font-semibold leading-7">{nextCard.name}</p>
              <p className="text-sm text-ink-soft">
                {nextStop.buyer} · {TYPE_LABEL[nextStop.locationType]} · {nextStop.parcel}
                {nextStop.payment === "cod" ? " · collect cash (COD)" : ""}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <BlockTag block={next.block} />
              <span className="text-ink-soft">
                ETA {fmt(next.arriveMin)} <span className="text-xs text-ink-faint">(simulated)</span>
              </span>
              <span>
                Chance <ChanceText p={next.p} />
              </span>
            </div>
            <div className="space-y-1.5 rounded-lg bg-canvas p-3 text-sm">
              <p className="flex gap-2">
                <DoorOpen className="mt-0.5 size-4 shrink-0 text-ink-faint" />
                <span>
                  {next.pointSource === "pickup point" ? "Deliver to the pickup point chosen by the buyer" : nextCard.entrance}
                  {nextCard.temporaryClosure ? <span className="block text-bad">{nextCard.temporaryClosure.text}</span> : null}
                </span>
              </p>
              <p className="flex gap-2">
                <MapPin className="mt-0.5 size-4 shrink-0 text-ink-faint" />
                <span>{nextCard.handover}</span>
              </p>
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-ink-faint">Why this stop now</p>
              <ul className="list-disc space-y-1 pl-5 text-sm text-ink-soft">
                {next.reasons.slice(0, 3).map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
              {next.flags.map((f) => (
                <p key={f} className="mt-1 flex gap-1 text-sm text-bad">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0" /> {f}
                </p>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Button variant="outline" className="h-auto flex-col py-2 text-xs" onClick={() => setCard({ key: nextStop.locationKey, stopId: next.stopId })}>
                <FileText /> Open stop card
              </Button>
              <Button variant="outline" className="h-auto flex-col py-2 text-xs" onClick={() => setIssueFor(next)}>
                <Flag /> Report issue
              </Button>
              <Button variant="primary" className="h-auto flex-col py-2 text-xs" onClick={() => setOutcomeFor(next)}>
                <CheckCircle2 /> Record outcome
              </Button>
            </div>
          </div>
        </section>
      ) : (
        <EmptyState title={remaining.length ? "Remaining stops need the dispatcher" : "All stops done for this shift"}>
          {remaining.length ? "The stops left are not scheduled (for example, a closed site). The dispatcher decides what happens next." : "Outcomes are saved in the evidence log and in each stop card's history."}
        </EmptyState>
      )}

      {later.length ? (
        <section aria-labelledby="later" className="rounded-xl border border-line bg-surface">
          <h2 id="later" className="border-b border-line px-4 py-2.5 text-sm font-semibold">
            Then ({later.length})
          </h2>
          <ol>
            {later.map((s) => {
              const st = stopById[s.stopId];
              const c = cards[st.locationKey];
              const unscheduled = Number.isNaN(s.arriveMin);
              return (
                <li key={s.stopId} className="flex items-center gap-3 border-b border-line/70 px-4 py-2.5 last:border-0">
                  <span className="w-6 text-right text-sm text-ink-faint">{s.seq}</span>
                  <button className="min-w-0 flex-1 text-left" onClick={() => setCard({ key: st.locationKey, stopId: s.stopId })}>
                    <span className="block truncate text-sm font-medium">{c.name}</span>
                    <span className="block text-xs text-ink-faint">
                      {s.stopId} · {st.payment === "cod" ? "COD" : "prepaid"}
                      {s.pointSource === "pickup point" ? " · pickup point" : ""}
                    </span>
                  </button>
                  {unscheduled ? (
                    <Badge tone="bad">Dispatcher</Badge>
                  ) : (
                    <span className="text-right text-xs">
                      <span className="block font-medium">{fmt(s.arriveMin)}</span>
                      <span className="text-ink-faint">{blockInfo(s.block).label.toLowerCase()}</span>
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      ) : null}

      {done.length ? (
        <section className="rounded-xl border border-line bg-surface">
          <button className="flex w-full items-center justify-between px-4 py-2.5 text-sm font-semibold" onClick={() => setShowDone(!showDone)} aria-expanded={showDone}>
            Completed ({done.length}) <ChevronDown className={cn("size-4 transition-transform", showDone && "rotate-180")} />
          </button>
          {showDone ? (
            <ul className="border-t border-line">
              {done.map((s) => (
                <li key={s.stopId} className="flex justify-between px-4 py-2 text-sm">
                  <span>
                    {s.stopId} · {cards[stopById[s.stopId].locationKey].name}
                  </span>
                  <Badge tone={states[s.stopId].status === "delivered" ? "ok" : "bad"}>{states[s.stopId].status}</Badge>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      <p className="flex items-center gap-2 text-xs text-ink-faint">
        <Navigation className="size-3.5" /> Times are simulated from the plan. <SourceTag kind="simulated" />
      </p>

      <StopCardDialog cardKey={card?.key ?? null} stopId={card?.stopId} open={!!card} onOpenChange={(o) => !o && setCard(null)} from="rider screen" />
      <OutcomeDialog stop={outcomeFor} onClose={() => setOutcomeFor(null)} />
      <IssueDialog stop={issueFor} onClose={() => setIssueFor(null)} onCorrection={(key, id) => setCard({ key, stopId: id })} />
    </div>
  );
}

function OutcomeDialog({ stop, onClose }: { stop: PlannedStop | null; onClose: () => void }) {
  const { update } = useDemo();
  const [result, setResult] = React.useState<"delivered" | "failed">("delivered");
  const [reason, setReason] = React.useState(FAIL_REASONS[0]);
  React.useEffect(() => {
    setResult("delivered");
    setReason(FAIL_REASONS[0]);
  }, [stop]);
  if (!stop) return null;
  return (
    <Dialog open={!!stop} onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={`Record outcome for ${stop.stopId}`} description="This fixes the stop in later plans and adds the result to the site's history.">
        <fieldset className="grid grid-cols-2 gap-2">
          <legend className="sr-only">Outcome</legend>
          {(["delivered", "failed"] as const).map((r) => (
            <label key={r} className={cn("cursor-pointer rounded-lg border p-3 text-center text-sm font-medium", result === r ? (r === "delivered" ? "border-ok bg-ok-tint text-ok" : "border-bad bg-bad-tint text-bad") : "border-line")}>
              <input type="radio" name="outcome" className="sr-only" checked={result === r} onChange={() => setResult(r)} />
              {r === "delivered" ? "Delivered" : "Not delivered"}
            </label>
          ))}
        </fieldset>
        {result === "failed" ? (
          <div className="mt-3">
            <Label htmlFor="fail-reason">Reason</Label>
            <Select id="fail-reason" value={reason} onChange={(e) => setReason(e.target.value)}>
              {FAIL_REASONS.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </Select>
            <p className="mt-2 text-xs text-ink-faint">The parcel stays with the rider for a later attempt; it is not re-added to today&apos;s route automatically.</p>
          </div>
        ) : null}
        <div className="mt-4 flex justify-end">
          <Button
            variant="primary"
            onClick={() => {
              update((s) => recordOutcome(s, stop.stopId, result, result === "failed" ? reason : undefined));
              onClose();
            }}
          >
            Save outcome
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function IssueDialog({ stop, onClose, onCorrection }: { stop: PlannedStop | null; onClose: () => void; onCorrection: (key: string, stopId: string) => void }) {
  const { update, shift, cards } = useDemo();
  const [kind, setKind] = React.useState<"closed" | "wrong" | "other">("closed");
  const [duration, setDuration] = React.useState<"alt" | "1300" | "rest">("1300");
  const [text, setText] = React.useState("");
  if (!stop) return null;
  const st = shift.stops.find((s) => s.id === stop.stopId)!;
  const card = cards[st.locationKey];
  return (
    <Dialog open={!!stop} onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={`Report an issue at ${card.name}`} description={`Order ${stop.stopId}`}>
        <div className="space-y-3">
          <div>
            <Label htmlFor="issue-kind">What happened?</Label>
            <Select id="issue-kind" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
              <option value="closed">Entrance temporarily unavailable</option>
              <option value="wrong">Entrance or handover information is wrong</option>
              <option value="other">Something else</option>
            </Select>
          </div>
          {kind === "closed" ? (
            <div>
              <Label htmlFor="issue-duration">How long?</Label>
              <Select id="issue-duration" value={duration} onChange={(e) => setDuration(e.target.value as typeof duration)}>
                {card.alternateEntrance ? <option value="alt">Use the alternate entrance ({card.alternateEntrance})</option> : null}
                <option value="1300">Closed until 13:00</option>
                <option value="rest">Closed for the rest of the shift</option>
              </Select>
              <p className="mt-2 text-xs text-ink-faint">This creates a replanning proposal. Nothing changes until it is accepted.</p>
            </div>
          ) : null}
          {kind === "other" ? (
            <div>
              <Label htmlFor="issue-text">Describe it</Label>
              <Textarea id="issue-text" value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. Heavy rain, road flooded near the factory" />
            </div>
          ) : null}
          {kind === "wrong" ? <p className="text-sm text-ink-soft">Open the stop card and use Suggest correction. A dispatcher reviews it before the card changes.</p> : null}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={kind === "other" && !text.trim()}
            onClick={() => {
              if (kind === "closed") update((s) => reportEntranceClosed(s, stop.stopId, duration === "rest" || duration === "alt" ? null : 13 * 60, duration === "alt"));
              if (kind === "other") update((s) => reportOtherIssue(s, stop.stopId, text.trim()));
              if (kind === "wrong") onCorrection(st.locationKey, stop.stopId);
              onClose();
            }}
          >
            {kind === "wrong" ? "Open stop card" : "Send report"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
