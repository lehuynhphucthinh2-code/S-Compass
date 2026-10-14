"use client";

import { Check, X } from "lucide-react";
import * as React from "react";
import { CardStatusBadge, TYPE_LABEL } from "@/components/bits";
import { StopCardDialog } from "@/components/StopCardDialog";
import { Button } from "@/components/ui/button";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { fixtures } from "@/lib/data";
import { decideCorrection } from "@/lib/demoState";
import type { CardStatus } from "@/lib/types";
import { cn, pct } from "@/lib/utils";
import { useDemo } from "@/state/DemoProvider";

const ORDER: CardStatus[] = ["disputed", "unverified", "suggested", "verified"];

export default function StopsPage() {
  const { state, update, cards, shift } = useDemo();
  const [open, setOpen] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState<CardStatus | "all">("all");
  const pending = state.corrections.filter((c) => c.status === "pending");
  const decided = state.corrections.filter((c) => c.status !== "pending").slice().reverse();
  const list = fixtures.knowledge
    .map((k) => cards[k.key])
    .filter((c) => filter === "all" || c.status === filter)
    .sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status));
  const counts = Object.fromEntries(ORDER.map((s) => [s, Object.values(cards).filter((c) => c.status === s).length]));
  const ordersToday = (key: string) => shift.stops.filter((s) => s.locationKey === key).length;
  const isDispatcher = state.role === "dispatcher";

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-semibold">Stop Knowledge Map</h1>
          <p className="max-w-3xl text-sm text-ink-soft">
            One card per delivery site in the demo zone. Cards start from dataset notes (suggested) and only become verified after a rider confirms on site and a
            dispatcher approves. A dataset coordinate is never treated as a verified entrance.
          </p>
        </div>
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter by status">
          {(["all", ...ORDER] as const).map((f) => (
            <button
              key={f}
              role="tab"
              aria-selected={filter === f}
              onClick={() => setFilter(f)}
              className={cn("rounded-md border px-3 py-1 text-sm", filter === f ? "border-ink bg-ink text-white" : "border-line bg-surface text-ink-soft")}
            >
              {f === "all" ? `All (${fixtures.knowledge.length})` : `${f[0].toUpperCase()}${f.slice(1)} (${counts[f]})`}
            </button>
          ))}
        </div>
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((c) => (
            <li key={c.key}>
              <button onClick={() => setOpen(c.key)} className="h-full w-full rounded-xl border border-line bg-surface p-4 text-left hover:border-ink-faint">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-semibold leading-5">{c.name}</span>
                  <CardStatusBadge status={c.status} />
                </div>
                <p className="mt-0.5 text-xs text-ink-faint">
                  {TYPE_LABEL[c.type]} · {c.visits} dataset visits · {ordersToday(c.key)} {ordersToday(c.key) === 1 ? "order" : "orders"} in this shift
                </p>
                <p className="mt-2 text-sm">{c.entrance}</p>
                <p className="text-sm text-ink-soft">{c.handover}</p>
                {c.restrictions.length ? (
                  <p className="mt-1 text-xs text-warn">{c.restrictions.map((r) => r.text).join("; ")}</p>
                ) : null}
                <p className="mt-2 text-xs text-ink-faint">
                  Pin spread {c.pinSpreadMeters ?? "—"} m · first-attempt success {pct(fixtures.knowledge.find((k) => k.key === c.key)!.firstAttemptSuccess)} · last verified {c.lastVerified ?? "never"}
                </p>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-4">
        <Panel>
          <PanelHeader title="Corrections to review" note={isDispatcher ? "Approving makes the card verified and the next plan uses it" : "Switch demo role to Dispatcher to approve"} />
          {pending.length ? (
            <ul className="divide-y divide-line">
              {pending.map((c) => (
                <li key={c.id} className="space-y-2 px-4 py-3 text-sm">
                  <p>
                    <span className="font-medium">{cards[c.locationKey].name}</span> — {c.field.replace("_", " ")}
                  </p>
                  <p className="rounded-md bg-canvas px-2 py-1">{c.text}</p>
                  <p className="text-xs text-ink-faint">
                    From {c.proposedBy} at {new Date(c.createdAt).toLocaleTimeString()}
                  </p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ok" disabled={!isDispatcher} onClick={() => update((s) => decideCorrection(s, c.id, true))}>
                      <Check /> Approve
                    </Button>
                    <Button size="sm" variant="danger" disabled={!isDispatcher} onClick={() => update((s) => decideCorrection(s, c.id, false, "Rejected in review queue"))}>
                      <X /> Reject
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setOpen(c.locationKey)}>
                      Open card
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-6 text-sm text-ink-faint">Nothing to review. Riders send corrections from a stop card with Suggest correction.</p>
          )}
        </Panel>
        {decided.length ? (
          <Panel>
            <PanelHeader title="Decided" />
            <ul className="divide-y divide-line text-sm">
              {decided.map((c) => (
                <li key={c.id} className="flex justify-between gap-2 px-4 py-2">
                  <span>
                    {cards[c.locationKey].name}: {c.text}
                  </span>
                  <span className={c.status === "approved" ? "text-ok" : "text-bad"}>{c.status}</span>
                </li>
              ))}
            </ul>
          </Panel>
        ) : null}
      </div>
      <StopCardDialog cardKey={open} open={!!open} onOpenChange={(o) => !o && setOpen(null)} from="stop knowledge map" />
    </div>
  );
}
