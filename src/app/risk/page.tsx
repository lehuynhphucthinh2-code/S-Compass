"use client";

import { ArrowRight, Database, Gauge, ShieldCheck, Sparkles, UserCheck } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { type BadDataKey, badDataScenario, fallbackLadder, overloadScenario, thinGroups } from "@/lib/risk";
import { makePlan } from "@/lib/planner";
import { METHOD_LABEL } from "@/lib/planner";
import { SHIFT_END, fmt } from "@/lib/time";
import { cn } from "@/lib/utils";
import { useDemo } from "@/state/DemoProvider";

type Tab = "overload" | "ai" | "data";
const TABS: { id: Tab; label: string; icon: React.ReactNode; ask: string }[] = [
  { id: "overload", label: "System overload", icon: <Gauge className="size-4" />, ask: "“Too many parcels arrive at once.”" },
  { id: "ai", label: "AI uncertainty", icon: <Sparkles className="size-4" />, ask: "“The estimate looks wrong or the model fails.”" },
  { id: "data", label: "Missing or odd data", icon: <Database className="size-4" />, ask: "“The file is incomplete or full of errors.”" },
];

export default function RiskPage() {
  const [tab, setTab] = React.useState<Tab>("overload");
  return (
    <div className="space-y-5">
      <Panel>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-5 py-4">
          <span className="text-sm font-semibold">Our rule for every risk</span>
          {["Never guess", "Use a stated fallback", "Flag it", "A person decides"].map((t, i, a) => (
            <React.Fragment key={t}>
              <span className="rounded-full bg-brand-tint px-3 py-1 text-sm font-medium text-brand-ink">{t}</span>
              {i < a.length - 1 ? <ArrowRight className="size-4 text-ink-faint" aria-hidden /> : null}
            </React.Fragment>
          ))}
        </div>
      </Panel>

      <div role="tablist" aria-label="Risk area" className="grid gap-3 md:grid-cols-3">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "rounded-xl border px-4 py-3 text-left transition-colors",
              tab === t.id ? "border-navy-2 bg-navy-2 text-white shadow-md" : "border-line bg-surface hover:border-navy-2/40",
            )}
          >
            <span className="flex items-center gap-2 text-base font-semibold">
              {t.icon} {t.label}
            </span>
            <span className={cn("mt-0.5 block text-sm", tab === t.id ? "text-white/75" : "text-ink-faint")}>{t.ask}</span>
          </button>
        ))}
      </div>

      {tab === "overload" ? <Overload /> : tab === "ai" ? <AiUncertainty /> : <BadData />}
    </div>
  );
}

function Tile({ label, value, tone, sub }: { label: string; value: React.ReactNode; tone?: "bad" | "ok" | "warn"; sub?: string }) {
  return (
    <div className="rounded-xl border border-line/60 bg-surface px-4 py-3">
      <div className="text-xs text-ink-faint">{label}</div>
      <div className={cn("text-3xl font-bold tracking-tight", tone === "bad" && "text-bad", tone === "ok" && "text-ok", tone === "warn" && "text-warn")}>{value}</div>
      {sub ? <div className="text-xs text-ink-faint">{sub}</div> : null}
    </div>
  );
}

function Response({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1.5 text-sm">
      {items.map((t) => (
        <li key={t} className="flex gap-2">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-ok" aria-hidden /> <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ 1. overload */
function Overload() {
  const { shift, cards } = useDemo();
  const [n, setN] = React.useState(0);
  const r = React.useMemo(() => (n ? overloadScenario(shift, n, cards) : null), [n, shift, cards]);
  return (
    <Panel>
      <PanelHeader title="System overload" note="Run a bigger batch through the same planner. Nothing here changes your demo plan." />
      <div className="space-y-5 px-5 py-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-ink-soft">Parcels arrive at once:</span>
          {[60, 100, 200, 300].map((v) => (
            <Button key={v} variant={n === v ? "primary" : "outline"} onClick={() => setN(v)}>
              {v}
            </Button>
          ))}
          {n ? (
            <Button variant="ghost" onClick={() => setN(0)}>
              Clear
            </Button>
          ) : null}
        </div>
        {r ? (
          <>
            <div className="sc-fade grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Tile label="Parcels in the batch" value={r.parcels} sub="Planner finished without error" />
              <Tile label="Planning time" value={`${Math.max(1, Math.round(r.ms))} ms`} tone="ok" sub="Computed in the browser" />
              <Tile label={`Arrive by ${fmt(SHIFT_END)}`} value={r.onTime} tone="ok" />
              <Tile label="Would run past shift end" value={r.overflow} tone={r.overflow ? "bad" : "ok"} sub={r.overflow ? "Held for the dispatcher" : "All fit in one shift"} />
            </div>
            <p className="rounded-lg bg-canvas px-4 py-3 text-sm">
              {r.overflow
                ? `One rider cannot finish ${r.parcels} parcels today. S-Compass does not squeeze them in or hide it: ${r.overflow} parcels are marked as arriving after ${fmt(SHIFT_END)}, and the dispatcher chooses to move them to a backup rider or to the next day.`
                : `This batch fits in one shift. The plan ends at about ${fmt(r.plan.totals.endMin)} (simulated).`}
            </p>
          </>
        ) : (
          <p className="rounded-lg border border-dashed border-line bg-canvas/40 px-4 py-6 text-center text-sm text-ink-faint">Choose a batch size to run it.</p>
        )}
        <div>
          <div className="mb-2 text-sm font-semibold">What S-Compass does</div>
          <Response
            items={[
              "Plans every parcel with the same rules. Nothing is dropped silently.",
              "Shows the shift end on the timeline and lists every stop that arrives after it.",
              "Import has a hard limit of 10,000 rows, and a warning when one rider-day has more than 40 parcels.",
              "The dispatcher can move parcels to the backup rider (Dispatcher page).",
            ]}
          />
        </div>
        <p className="text-xs text-ink-faint">The extra parcels repeat the real stops of the selected demo shift with new ids. Times are simulated estimates.</p>
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ 2. AI uncertainty */
function AiUncertainty() {
  const { shift, cards, state } = useDemo();
  const states = state.stopStates[shift.id];
  const ladder = React.useMemo(() => fallbackLadder(shift, cards, states), [shift, cards, states]);
  const plan = React.useMemo(() => makePlan({ shift, method: "rules", cards, stopStates: states }), [shift, cards, states]);
  const thin = React.useMemo(() => thinGroups(shift, plan), [shift, plan]);
  const [off, setOff] = React.useState(false);
  const active = off ? ladder.find((x) => x.method === "rules")! : ladder.find((x) => x.method === "model")!;
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <Panel>
        <PanelHeader title="If the AI model fails or is not trusted" note={`Same shift: ${shift.weekday} ${shift.date} · ${shift.stops.length} parcels`} />
        <div className="space-y-4 px-5 py-5">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant={off ? "outline" : "primary"} onClick={() => setOff(false)}>
              Model is working
            </Button>
            <Button variant={off ? "danger" : "outline"} onClick={() => setOff(true)}>
              Model output rejected
            </Button>
          </div>
          <div className="sc-fade grid grid-cols-3 gap-3" key={String(off)}>
            <Tile label="Plan used" value={<span className="text-xl">{off ? "S-Compass rules" : "AI model (test)"}</span>} tone={off ? "warn" : undefined} />
            <Tile label="Expected successes" value={active.expectedSuccess.toFixed(1)} />
            <Tile label="Estimated finish" value={fmt(active.endMin)} />
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-ink-faint">
                <th className="py-1 font-medium">Method</th>
                <th className="font-medium">Expected successes</th>
                <th className="font-medium">Finish</th>
                <th className="font-medium">Flagged</th>
              </tr>
            </thead>
            <tbody>
              {ladder.map((x) => (
                <tr key={x.method} className="border-t border-line/60">
                  <td className="py-1.5 font-medium">{METHOD_LABEL[x.method]}</td>
                  <td>{x.expectedSuccess.toFixed(1)}</td>
                  <td>{fmt(x.endMin)}</td>
                  <td>{x.flagged}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="rounded-lg bg-canvas px-4 py-3 text-sm">
            {off
              ? "The model is switched off. The plan falls back to the S-Compass rules, which use the history table and the site rules. If those are not trusted either, the dispatcher uses Today’s app. A valid plan always exists."
              : "The AI model is marked experimental. It only chooses the time block. Site rules and capacity checks still apply to its plan."}
          </p>
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="If one estimate looks too good or too bad" note="The estimates that rest on the fewest past attempts in this shift" />
        <div className="space-y-4 px-5 py-5">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-ink-faint">
                <th className="py-1 font-medium">Stop</th>
                <th className="font-medium">Group</th>
                <th className="font-medium">Past attempts</th>
                <th className="font-medium">Raw rate</th>
                <th className="font-medium">Used</th>
              </tr>
            </thead>
            <tbody>
              {thin.map((g) => (
                <tr key={g.stopId} className="border-t border-line/60">
                  <td className="py-1.5 font-medium">#{g.seq}</td>
                  <td className="text-ink-soft">{g.label}</td>
                  <td>{g.attempts.toLocaleString()}</td>
                  <td>{g.rawRate === null ? "n/a" : `${(g.rawRate * 100).toFixed(1)}%`}</td>
                  <td className="font-semibold">{(g.p * 100).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div>
            <div className="mb-2 text-sm font-semibold">What S-Compass does</div>
            <Response
              items={[
                "A small group is smoothed toward the overall average, so a few lucky or unlucky attempts cannot give an extreme number (see “Raw rate” and “Used”).",
                "Every stop explains its own number (Dispatcher, “How this estimate is calculated”).",
                "Stops under 65% or with a warning are flagged for the dispatcher.",
                "Pickup points get no number at all, because the table has no data for them.",
              ]}
            />
          </div>
          <p className="flex items-center gap-2 text-sm text-ink-soft">
            <UserCheck className="size-4 text-info" aria-hidden /> The estimate is a guide. The dispatcher can always change a plan before it is sent.
          </p>
        </div>
      </Panel>
    </div>
  );
}

/* ------------------------------------------------------------------ 3. missing / odd data */
const BAD: { id: BadDataKey; label: string; hint: string }[] = [
  { id: "messy", label: "Messy file", hint: "missing pins, wrong dates, duplicates" },
  { id: "empty", label: "Empty file", hint: "nothing inside" },
  { id: "columns", label: "Wrong columns", hint: "not delivery data" },
];

function BadData() {
  const [k, setK] = React.useState<BadDataKey | null>(null);
  const res = React.useMemo(() => (k ? badDataScenario(k) : null), [k]);
  return (
    <Panel>
      <PanelHeader title="Missing and anomalous data" note="The same checks as the Data intake page, run on a test file. Nothing is imported." />
      <div className="space-y-5 px-5 py-5">
        <div className="flex flex-wrap items-center gap-2">
          {BAD.map((b) => (
            <Button key={b.id} variant={k === b.id ? "primary" : "outline"} onClick={() => setK(b.id)} title={b.hint}>
              {b.label}
            </Button>
          ))}
          <Link href="/intake" className="ml-auto inline-flex items-center gap-1.5 text-sm text-info hover:underline">
            Try your own file in Data intake <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
        {res ? (
          res.ok ? (
            <div className="sc-fade space-y-4">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Tile label="Rows read" value={res.batch.summary.rowsRead} />
                <Tile label="Accepted" value={res.batch.summary.accepted} tone="ok" />
                <Tile label="Accepted with warning" value={res.batch.summary.warning} tone="warn" />
                <Tile label="Quarantined (not used)" value={res.batch.summary.quarantined} tone="bad" sub="Kept and shown, never dropped silently" />
              </div>
              <div className="overflow-x-auto rounded-lg border border-line/60">
                <table className="w-full text-sm">
                  <thead className="bg-canvas/60 text-left text-xs text-ink-faint">
                    <tr>
                      <th className="px-3 py-2 font-medium">Row</th>
                      <th className="font-medium">Order</th>
                      <th className="font-medium">Result</th>
                      <th className="font-medium">Why</th>
                    </tr>
                  </thead>
                  <tbody>
                    {res.batch.rows.slice(0, 8).map((r) => (
                      <tr key={`${r.row}-${r.orderId}`} className="border-t border-line/60 align-top">
                        <td className="px-3 py-1.5">{r.row}</td>
                        <td>{r.orderId || "(none)"}</td>
                        <td>
                          <Badge tone={r.status === "quarantined" ? "bad" : "warn"}>{r.status}</Badge>
                        </td>
                        <td className="py-1.5 pr-3 text-ink-soft">{r.issues.join("; ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {res.batch.rows.length > 8 ? <p className="text-xs text-ink-faint">Showing 8 of {res.batch.rows.length} rows with issues. All of them appear in Data intake.</p> : null}
            </div>
          ) : (
            <div className="sc-fade rounded-lg border border-bad/30 bg-bad-tint px-4 py-3 text-sm">
              <div className="font-semibold text-bad">The file is refused with a clear reason</div>
              <p className="mt-1">{res.error}</p>
              {res.foundColumns.length ? <p className="mt-1 text-ink-soft">Columns found: {res.foundColumns.join(", ")}</p> : null}
            </div>
          )
        ) : (
          <p className="rounded-lg border border-dashed border-line bg-canvas/40 px-4 py-6 text-center text-sm text-ink-faint">Choose a test file to run it.</p>
        )}
        <div>
          <div className="mb-2 text-sm font-semibold">What S-Compass does</div>
          <Response
            items={[
              "Every row gets a result: accepted, accepted with warning, or quarantined with the reason.",
              "Missing values use a stated fallback (for example, no map pin means a flagged stop), never an invented number.",
              "Odd values are caught: wrong dates, swapped latitude and longitude, pins far from the site, duplicate orders.",
              "The dispatcher can fix the column mapping, then import. A bad file never changes the current plan.",
            ]}
          />
        </div>
      </div>
    </Panel>
  );
}
