"use client";

import { Compass, Database, HardDrive, HelpCircle, RotateCcw, TriangleAlert, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { setTester } from "@/lib/demoState";
import type { Role } from "@/lib/evidence";
import { cn } from "@/lib/utils";
import { useDemo } from "@/state/DemoProvider";
import { usePresent } from "@/state/PresentMode";

const NAV: { href: string; label: string; role?: Role }[] = [
  { href: "/dispatcher", label: "Dispatcher", role: "dispatcher" },
  { href: "/intake", label: "Data intake", role: "dispatcher" },
  { href: "/rider", label: "Rider", role: "rider" },
  { href: "/stops", label: "Stop cards" },
  { href: "/buyer", label: "Buyer simulation", role: "buyer" },
  { href: "/replan", label: "Replanning" },
  { href: "/risk", label: "Risk desk" },
  { href: "/evidence", label: "Evidence" },
  { href: "/how-it-works", label: "How it works" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { state, update, reset, adapter, saveStatus, loadError } = useDemo();
  const openProposals = state.proposals.filter((p) => p.status === "open" && p.previous.shiftId === state.shiftId).length;
  const pendingCorrections = state.corrections.filter((c) => c.status === "pending").length;

  // Visiting a role's main screen switches the demo role, so events are logged with the right role.
  const lastPath = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    const item = NAV.find((n) => pathname?.startsWith(n.href));
    if (item?.role) update((s) => (s.role === item.role ? s : { ...s, role: item.role! }));
  }, [pathname, update]);

  const { present } = usePresent();
  React.useEffect(() => {
    const item = NAV.find((n) => pathname?.startsWith(n.href));
    const title = item ? `${item.label} · S-Compass` : "S-Compass · competition prototype";
    document.title = title;
    const t = setTimeout(() => {
      document.title = title; // Next sets its default title after hydration; set ours again
    }, 150);
    return () => clearTimeout(t);
  }, [pathname]);
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-navy text-white shadow-lg">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5">
          <Link href="/dispatcher" className="flex items-center gap-2.5" aria-label="S-Compass home">
            <span className="grid size-9 place-items-center rounded-lg bg-brand text-white">
              <Compass className="size-5" aria-hidden />
            </span>
            <span className="leading-tight">
              <span className="block text-[17px] font-semibold tracking-tight text-white">S-Compass</span>
              <span className="block text-[11px] text-white/60">Competition prototype</span>
            </span>
          </Link>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <PresentToggle />
            <AnimToggle />
            <TourButton />
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium",
                adapter.mode === "local" ? "bg-amber-300/15 text-amber-200" : "bg-sky-300/15 text-sky-200",
              )}
              title={adapter.label}
            >
              {adapter.mode === "local" ? <HardDrive className="size-3.5" /> : <Database className="size-3.5" />}
              {adapter.mode === "local" ? "Demo Mode" : "Supabase"}
            </span>
            <label className={cn("flex items-center gap-1.5 text-xs text-white/70", present && "hidden")}>
              <span className="hidden sm:inline">Demo role</span>
              <select
                aria-label="Demo role switcher (demo interaction, not a permission system)"
                title="Demo interaction, not a permission system"
                className="h-8 rounded-md border border-line bg-surface px-2 text-xs text-ink"
                value={state.role}
                onChange={(e) => update((s) => ({ ...s, role: e.target.value as Role }))}
              >
                <option value="dispatcher">Dispatcher</option>
                <option value="rider">Rider</option>
                <option value="buyer">Buyer</option>
              </select>
            </label>
            {present ? null : <TesterButton />}
            <Dialog>
              <DialogTrigger asChild>
                <Button size="sm" variant="ghost" aria-label="Reset demo" className="text-white/80 hover:bg-white/10 hover:text-white">
                  <RotateCcw /> Reset demo
                </Button>
              </DialogTrigger>
              <DialogContent title="Reset the demo?" description="This restores the original fixtures and clears plans, corrections, buyer replies, imported data and the evidence log in this browser.">
                <p className="mb-4 text-sm text-ink-soft">Export the evidence log first if you need it for your test records.</p>
                <div className="flex justify-end gap-2">
                  <DialogClose asChild>
                    <Button>Cancel</Button>
                  </DialogClose>
                  <DialogClose asChild>
                    <Button variant="primary" onClick={reset}>
                      Reset demo
                    </Button>
                  </DialogClose>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
        <nav className="mx-auto max-w-[1440px] overflow-x-auto px-2" aria-label="Main">
          <ul className="flex min-w-max gap-1 px-2">
            {NAV.map((n) => {
              const active = pathname?.startsWith(n.href);
              const count = n.href === "/replan" ? openProposals : n.href === "/stops" ? pendingCorrections : 0;
              return (
                <li key={n.href}>
                  <Link
                    href={n.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm",
                      active ? "border-brand font-semibold text-white" : "border-transparent text-white/65 hover:text-white",
                    )}
                  >
                    {n.label}
                    {count > 0 ? <span className="rounded-full bg-brand px-1.5 text-[11px] font-semibold text-white">{count}</span> : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </header>

      <PageBanner pathname={pathname} />
      {loadError ? (
        <div role="alert" className="border-b border-bad/30 bg-bad-tint px-4 py-2 text-sm text-bad">
          <TriangleAlert className="mr-1 inline size-4" /> {loadError}. Started a fresh local demo instead.
        </div>
      ) : null}
      {saveStatus && !saveStatus.ok ? (
        <div role="alert" className="border-b border-bad/30 bg-bad-tint px-4 py-2 text-sm text-bad">
          <TriangleAlert className="mr-1 inline size-4" /> {saveStatus.message}
        </div>
      ) : null}

      <main className="mx-auto max-w-[1440px] px-4 py-5">{children}</main>
      <Tour />
      <footer className="mx-auto max-w-[1440px] px-4 pb-8 text-xs leading-5 text-ink-faint">
        S-Compass is a Business Challenge 2026 competition prototype by team BCE004 (Watt the hedge). It is not an official Shopee product. Buyer and place names are fictional.
        Positions are de-identified dataset pins. No real SMS, e-mail or payment request is ever sent.
        {saveStatus?.ok ? ` Last saved ${new Date(saveStatus.at).toLocaleTimeString()} (${saveStatus.target === "browser" ? "this browser" : "Supabase"}).` : ""}
      </footer>
    </div>
  );
}

const PERSONAS = [
  "Presenter (team member)",
  "Mock persona: new rider (week 3)",
  "Mock persona: veteran rider (2 years)",
  "Mock persona: hub dispatcher",
  "Mock persona: office buyer",
  "Mock persona: factory-shift buyer",
  "Peer tester (student)",
];

function TesterButton() {
  const { state, update } = useDemo();
  const [name, setName] = React.useState(state.tester.name);
  const [persona, setPersona] = React.useState(state.tester.persona);
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" title="Who is testing? Used in the evidence log" className="text-white/80 hover:bg-white/10 hover:text-white">
          Tester: {state.tester.name || "not set"}
        </Button>
      </DialogTrigger>
      <DialogContent title="Start a test session" description="The name and persona are written on every evidence event, so test logs can be checked later.">
        <div className="space-y-3">
          <div>
            <label htmlFor="tester-name" className="mb-1 block text-sm font-medium">
              Tester name or code
            </label>
            <input id="tester-name" className="h-10 w-full rounded-lg border border-line px-3 text-sm" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Peer-03" />
          </div>
          <div>
            <label htmlFor="tester-persona" className="mb-1 block text-sm font-medium">
              Persona
            </label>
            <select id="tester-persona" className="h-10 w-full rounded-lg border border-line px-3 text-sm" value={persona} onChange={(e) => setPersona(e.target.value)}>
              {PERSONAS.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end">
            <DialogClose asChild>
              <Button variant="primary" onClick={() => update((s) => setTester(s, name.trim(), persona))}>
                Start test session
              </Button>
            </DialogClose>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PresentToggle() {
  const { present, setPresent } = usePresent();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={present}
      onClick={() => setPresent(!present)}
      title="Presentation mode: short labels and big numbers. Turn off to see every detail."
      className={cn("inline-flex h-8 items-center gap-2 rounded-md border px-2.5 text-xs font-medium", present ? "border-brand bg-brand text-white" : "border-white/25 text-white/80")}
    >
      <span className={cn("relative h-4 w-7 rounded-full transition-colors", present ? "bg-white/40" : "bg-white/25")}>
        <span className={cn("absolute top-0.5 size-3 rounded-full bg-white transition-all", present ? "left-3.5" : "left-0.5")} />
      </span>
      Presentation {present ? "on" : "off"}
    </button>
  );
}

function AnimToggle() {
  const { anim, setAnim } = usePresent();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={anim}
      onClick={() => setAnim(!anim)}
      title="Animation: short movements that show what changed. Turn off if the computer is slow."
      className={cn("inline-flex h-8 items-center gap-2 rounded-md border px-2.5 text-xs font-medium", anim ? "border-white/25 bg-white/10 text-white" : "border-white/20 text-white/60")}
    >
      <span className={cn("relative h-4 w-7 rounded-full transition-colors", anim ? "bg-emerald-400" : "bg-white/25")}>
        <span className={cn("absolute top-0.5 size-3 rounded-full bg-white transition-all", anim ? "left-3.5" : "left-0.5")} />
      </span>
      Animation {anim ? "on" : "off"}
    </button>
  );
}

const TOUR_KEY = "s-compass-tour-v1";
const TOUR_STEPS = [
  { title: "1. Pick a rider and day", text: "Start on the Dispatcher. The “Start here” bar always shows the next step." },
  { title: "2. Generate and compare", text: "Generate a plan, then open Compare plans: Today’s app against S-Compass, with the same stops and the same scorer." },
  { title: "3. Have a file?", text: "Open Data intake: match the columns, review every row, then import. Nothing is planned until you confirm." },
];

function TourButton() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event("s-compass-tour"))}
      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-white/25 px-2.5 text-xs font-medium text-white/80 hover:text-white"
      title="Show the 3-step quick tour"
    >
      <HelpCircle className="size-3.5" /> Quick tour
    </button>
  );
}

/** A small card, not a full-screen overlay, so it never blocks the demo. It shows once; “Quick tour” replays it. */
function Tour() {
  const [step, setStep] = React.useState<number | null>(null);
  React.useEffect(() => {
    try {
      if (!window.localStorage.getItem(TOUR_KEY)) setStep(0);
    } catch {
      /* storage blocked: skip the automatic tour */
    }
    const open = () => setStep(0);
    window.addEventListener("s-compass-tour", open);
    return () => window.removeEventListener("s-compass-tour", open);
  }, []);
  const close = () => {
    setStep(null);
    try {
      window.localStorage.setItem(TOUR_KEY, "done");
    } catch {
      /* ignore */
    }
  };
  if (step === null) return null;
  const s = TOUR_STEPS[step];
  const last = step === TOUR_STEPS.length - 1;
  return (
    <aside className="sc-fade fixed bottom-4 right-4 z-40 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-line bg-surface p-4 shadow-xl" role="dialog" aria-label="Quick tour">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold">{s.title}</p>
        <button type="button" onClick={close} aria-label="Close the tour" className="text-ink-faint hover:text-ink">
          <X className="size-4" />
        </button>
      </div>
      <p className="mt-1 text-sm text-ink-soft">{s.text}</p>
      <div className="mt-3 flex items-center justify-between">
        <div className="flex gap-1.5" aria-hidden>
          {TOUR_STEPS.map((_, i) => (
            <span key={i} className={cn("size-2 rounded-full", i === step ? "bg-brand" : "bg-line")} />
          ))}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={close}>
            Skip
          </Button>
          <Button size="sm" variant="primary" onClick={() => (last ? close() : setStep(step + 1))}>
            {last ? "Done" : "Next"}
          </Button>
        </div>
      </div>
    </aside>
  );
}

const BANNERS: Record<string, { title: string; text: string }> = {
  "/dispatcher": { title: "Dispatcher", text: "Plan today’s deliveries, compare plans, and send the best one to the rider." },
  "/intake": { title: "Data intake", text: "Bring in an Excel or CSV file: match the columns, review every row, then import." },
  "/rider": { title: "Rider", text: "What the rider sees: the next stop, and why it comes now." },
  "/stops": { title: "Stop cards", text: "Local knowledge for each delivery site, checked before it is trusted." },
  "/buyer": { title: "Buyer simulation", text: "How a buyer confirms a delivery time. Simulated: no real messages are sent." },
  "/replan": { title: "Replanning", text: "When something changes, the app proposes a new plan and the dispatcher decides." },
  "/risk": { title: "Risk desk", text: "Overload, AI uncertainty and bad data: what the system does, live." },
  "/evidence": { title: "Evidence", text: "Every action is logged, so the results can be checked." },
  "/how-it-works": { title: "How it works", text: "The data, the scorer and the rules behind each plan." },
};

function PageBanner({ pathname }: { pathname: string | null }) {
  const key = Object.keys(BANNERS).find((k) => pathname?.startsWith(k));
  if (!key) return null;
  const b = BANNERS[key];
  return (
    <div className="bg-gradient-to-r from-navy via-navy-2 to-[#c2381d]">
      <div key={key} className="sc-fade mx-auto flex max-w-[1440px] flex-wrap items-baseline gap-x-4 gap-y-0.5 px-4 py-3 text-white">
        <p className="text-xl font-semibold tracking-tight">{b.title}</p>
        <p className="text-sm text-white/75">{b.text}</p>
      </div>
    </div>
  );
}
