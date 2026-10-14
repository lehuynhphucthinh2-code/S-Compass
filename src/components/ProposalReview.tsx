"use client";

import { Check, Undo2 } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Label, Textarea } from "@/components/ui/field";
import { decideProposal } from "@/lib/demoState";
import type { ReplanProposal } from "@/lib/replan";
import { fmt } from "@/lib/time";
import { cn } from "@/lib/utils";
import { useDemo } from "@/state/DemoProvider";

export function ProposalReview({ proposal, compact }: { proposal: ReplanProposal; compact?: boolean }) {
  const { update, cards, shift } = useDemo();
  const [overriding, setOverriding] = React.useState(false);
  const [note, setNote] = React.useState("");
  const stopById = Object.fromEntries(shift.stops.map((s) => [s.id, s]));
  const changed = new Set(proposal.changes.map((c) => c.stopId));
  const name = (id: string) => (stopById[id] ? cards[stopById[id].locationKey].name : id);
  const open = proposal.status === "open";

  const seq = (ids: string[], plan: ReplanProposal["previous"], label: string) => (
    <div className="min-w-0">
      <p className="mb-1 text-xs font-medium text-ink-faint">{label}</p>
      <ol className="space-y-0.5 text-sm">
        {ids.map((id, i) => {
          const ps = plan.stops.find((x) => x.stopId === id);
          const eta = ps && !Number.isNaN(ps.arriveMin) ? fmt(ps.arriveMin) : "not scheduled";
          return (
            <li key={id} className={cn("flex gap-2 rounded px-1", changed.has(id) && "bg-brand-tint")}>
              <span className="w-5 shrink-0 text-right text-ink-faint">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate">
                {id} <span className="text-ink-faint">{name(id)}</span>
              </span>
              <span className="shrink-0 text-xs text-ink-faint">{eta}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );

  return (
    <div className="space-y-3 text-sm">
      <div>
        <p className="text-xs font-medium text-ink-faint">What changed</p>
        <p className="font-medium">{proposal.triggerText}</p>
      </div>

      {compact ? (
        <div>
          <p className="text-xs font-medium text-ink-faint">Suggested update ({proposal.changes.length} stops change block or ETA by 15+ min)</p>
          <ul className="mt-1 space-y-1">
            {proposal.changes.slice(0, 5).map((c) => (
              <li key={c.stopId}>
                <span className="font-medium">{c.stopId}</span> {name(c.stopId)}:{" "}
                {c.beforePos ?? "—"} → {c.afterPos ?? "not scheduled"}
                {c.beforeBlock !== c.afterBlock ? ` (${c.beforeBlock ?? "—"} → ${c.afterBlock ?? "—"})` : ""}
              </li>
            ))}
            {proposal.changes.length > 5 ? <li className="text-ink-faint">and {proposal.changes.length - 5} more</li> : null}
          </ul>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {seq(proposal.previousRemaining, proposal.previous, "Previous remaining sequence")}
          {seq(proposal.proposedRemaining, proposal.proposed, "Proposed remaining sequence")}
          <p className="text-xs text-ink-faint md:col-span-2">Highlighted: stops whose block changes or whose ETA moves by 15 minutes or more.</p>
        </div>
      )}

      <div>
        <p className="text-xs font-medium text-ink-faint">Why this plan is proposed</p>
        <ul className="list-disc space-y-0.5 pl-5 text-ink-soft">
          {proposal.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </div>
      <div>
        <p className="text-xs font-medium text-ink-faint">Affected commitments</p>
        <ul className="list-disc space-y-0.5 pl-5 text-ink-soft">
          {proposal.commitments.map((r) => (
            <li key={r} className={r.includes("AT RISK") ? "text-bad" : undefined}>
              {r}
            </li>
          ))}
          <li>No parcel moves to another rider. A transfer needs an explicit dispatcher action.</li>
        </ul>
      </div>

      {open ? (
        overriding ? (
          <div className="space-y-2">
            <Label htmlFor={`ov-${proposal.id}`}>Why keep the current plan?</Label>
            <Textarea id={`ov-${proposal.id}`} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Buyer will meet me at the gate at 16:00" />
            <div className="flex justify-end gap-2">
              <Button onClick={() => setOverriding(false)}>Back</Button>
              <Button variant="dark" disabled={!note.trim()} onClick={() => update((s) => decideProposal(s, proposal.id, false, note.trim()))}>
                <Undo2 /> Keep current plan
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => update((s) => decideProposal(s, proposal.id, true))}>
              <Check /> Accept new plan
            </Button>
            <Button onClick={() => setOverriding(true)}>Keep current plan and explain</Button>
            <span className="self-center text-xs text-ink-faint">Riders: review only when safely stopped.</span>
          </div>
        )
      ) : (
        <p className={cn("text-sm font-medium", proposal.status === "accepted" ? "text-ok" : "text-ink-soft")}>
          {proposal.status === "accepted" ? "Accepted" : "Overridden"}
          {proposal.decisionNote ? `: ${proposal.decisionNote}` : ""}
        </p>
      )}
    </div>
  );
}
