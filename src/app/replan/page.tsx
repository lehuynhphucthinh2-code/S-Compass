"use client";

import { CalendarClock, DoorClosed } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { EmptyState } from "@/components/bits";
import { ProposalReview } from "@/components/ProposalReview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label, Select } from "@/components/ui/field";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { buyerChange, reportEntranceClosed } from "@/lib/demoState";
import { BLOCKS, blockLabel, fmt } from "@/lib/time";
import type { Block } from "@/lib/types";
import { useDemo } from "@/state/DemoProvider";

export default function ReplanPage() {
  const { state, update, shift, cards, plan } = useDemo();
  const states = state.stopStates[shift.id];
  const pending = plan ? plan.stops.filter((s) => states[s.stopId]?.status === "pending" && !Number.isNaN(s.arriveMin)) : [];
  const stopById = Object.fromEntries(shift.stops.map((s) => [s.id, s]));
  const proposals = [...state.proposals].filter((p) => p.previous.shiftId === shift.id).reverse();
  const open = proposals.find((p) => p.status === "open");

  const [winStop, setWinStop] = React.useState<string>("");
  const [winBlock, setWinBlock] = React.useState<Block>("evening");
  const [entStop, setEntStop] = React.useState<string>("");
  const [entMode, setEntMode] = React.useState<"alt" | "1300" | "rest">("1300");

  React.useEffect(() => {
    if (pending.length && !pending.find((p) => p.stopId === winStop)) setWinStop(pending[Math.min(1, pending.length - 1)].stopId);
    if (pending.length && !pending.find((p) => p.stopId === entStop)) setEntStop(pending[0].stopId);
  }, [pending, winStop, entStop]);

  if (!plan) {
    return (
      <EmptyState title="Dispatch a plan first" action={<Link href="/dispatcher" className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white">Go to dispatcher</Link>}>
        Live replanning changes a dispatched route. Generate and dispatch a plan, then come back to trigger the demo events.
      </EmptyState>
    );
  }

  const winCurrent = plan.stops.find((s) => s.stopId === winStop)?.block;
  const entCard = entStop ? cards[stopById[entStop].locationKey] : null;

  return (
    <div className="grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
      <div className="space-y-5">
        <Panel>
          <PanelHeader title="Demo event 1: buyer changes the window" note="Same as a buyer reply in the Buyer simulation" />
          <div className="space-y-3 px-4 py-3">
            <div>
              <Label htmlFor="win-stop">Order</Label>
              <Select id="win-stop" value={winStop} onChange={(e) => setWinStop(e.target.value)}>
                {pending.map((p) => (
                  <option key={p.stopId} value={p.stopId}>
                    {p.stopId} · {cards[stopById[p.stopId].locationKey].name} · now {p.block} {fmt(p.arriveMin)}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="win-block">New receiving window</Label>
              <Select id="win-block" value={winBlock} onChange={(e) => setWinBlock(e.target.value as Block)}>
                {BLOCKS.filter((b) => b.end > state.clockMin[shift.id]).map((b) => (
                  <option key={b.id} value={b.id} disabled={b.id === winCurrent}>
                    {blockLabel(b.id)}
                    {b.id === winCurrent ? " (current)" : ""}
                  </option>
                ))}
              </Select>
            </div>
            <Button variant="primary" className="w-full" disabled={!winStop || winBlock === winCurrent} onClick={() => update((s) => ({ ...buyerChange({ ...s, role: "buyer" }, winStop, winBlock), role: s.role }))}>
              <CalendarClock /> Send buyer change
            </Button>
          </div>
        </Panel>
        <Panel>
          <PanelHeader title="Demo event 2: entrance unavailable" note="Same as Report issue on the rider screen" />
          <div className="space-y-3 px-4 py-3">
            <div>
              <Label htmlFor="ent-stop">Order</Label>
              <Select id="ent-stop" value={entStop} onChange={(e) => setEntStop(e.target.value)}>
                {pending.map((p) => (
                  <option key={p.stopId} value={p.stopId}>
                    {p.stopId} · {cards[stopById[p.stopId].locationKey].name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="ent-mode">Situation</Label>
              <Select id="ent-mode" value={entMode} onChange={(e) => setEntMode(e.target.value as typeof entMode)}>
                {entCard?.alternateEntrance ? <option value="alt">Main entrance closed, use {entCard.alternateEntrance}</option> : null}
                <option value="1300">Closed until 13:00</option>
                <option value="rest">Closed for the rest of the shift</option>
              </Select>
            </div>
            <Button
              variant="primary"
              className="w-full"
              disabled={!entStop}
              onClick={() => update((s) => ({ ...reportEntranceClosed({ ...s, role: "dispatcher" }, entStop, entMode === "1300" ? 13 * 60 : null, entMode === "alt"), role: s.role }))}
            >
              <DoorClosed /> Report closure
            </Button>
            <p className="text-xs text-ink-faint">The closure applies to every order at that site for the rest of this demo shift. Reset demo clears it.</p>
          </div>
        </Panel>
      </div>

      <div className="space-y-5">
        {open ? (
          <Panel className="border-brand/50">
            <PanelHeader title="Proposed plan change" note={`Created ${new Date(open.createdAt).toLocaleTimeString()} · planner run ${open.proposed.computeMs} ms`} actions={<Badge tone="brand">Waiting for decision</Badge>} />
            <div className="px-4 py-4">
              <ProposalReview proposal={open} />
            </div>
          </Panel>
        ) : (
          <EmptyState title="No plan change waiting">Trigger one of the two demo events, or reply as a buyer in the Buyer simulation.</EmptyState>
        )}
        {proposals.filter((p) => p.status !== "open").length ? (
          <Panel>
            <PanelHeader title="Earlier plan changes" />
            <ul className="divide-y divide-line">
              {proposals
                .filter((p) => p.status !== "open")
                .map((p) => (
                  <li key={p.id} className="flex flex-wrap items-start justify-between gap-2 px-4 py-3 text-sm">
                    <span>
                      {p.triggerText}
                      {p.decisionNote ? <span className="block text-xs text-ink-faint">Note: {p.decisionNote}</span> : null}
                    </span>
                    <Badge tone={p.status === "accepted" ? "ok" : "neutral"}>{p.status}</Badge>
                  </li>
                ))}
            </ul>
          </Panel>
        ) : null}
      </div>
    </div>
  );
}
