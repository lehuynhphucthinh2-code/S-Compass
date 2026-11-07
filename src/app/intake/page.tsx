"use client";

import { Download, FileSpreadsheet, FlaskConical, Trash2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { SourceTag, Stat } from "@/components/bits";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { activeImportBatch, saveImportedLocal, setImported } from "@/lib/data";
import { recordImport, recordImportRemoved, selectShift } from "@/lib/demoState";
import { FIELD_INFO, HEAVY_DAY_PARCELS, MAX_ROWS, detectColumns, messySampleRows, parseCsv, parseTable, templateRows, toCsvText, type ColumnDetection, type Field, type ImportBatch, type ImportPurpose, type RowStatus } from "@/lib/intake";
import { cn, downloadText } from "@/lib/utils";
import { useDemo } from "@/state/DemoProvider";
import { Details, usePresent } from "@/state/PresentMode";

const STATUS_LABEL: Record<RowStatus, string> = { accepted: "Accepted", warning: "Accepted with warning", quarantined: "Quarantined" };
const STATUS_TONE: Record<RowStatus, "ok" | "warn" | "bad"> = { accepted: "ok", warning: "warn", quarantined: "bad" };

const RULES: [string, string, string][] = [
  ["No map pin", "Uses the place’s suggested drop-off point if other orders there have pins; the buyer is invited by Buyer Confirm", "Accepted with warning"],
  ["Pin outside Ho Chi Minh City", "Pin ignored as anomalous; treated as no pin, buyer is asked", "Accepted with warning"],
  ["Latitude and longitude swapped", "Corrected automatically and shown", "Accepted with warning"],
  [`Pin more than 300 m from the place’s other pins`, "The place’s suggested drop-off point is used before the raw pin", "Accepted with warning"],
  ["Payment missing or unknown", "Treated as COD (the safer, riskier case), so the buyer is asked", "Accepted with warning"],
  ["Impossible handover time (below 0 or over 120 min)", "Ignored; the planner uses its default time", "Accepted with warning"],
  ["New place with no history", "Scored with the place-type average; card starts “unverified”", "Accepted"],
  [`More than ${HEAVY_DAY_PARCELS} parcels for one rider-day`, "Everything is planned; a late finish is flagged and a backup rider can take parcels", "Accepted with warning"],
  ["Unknown or missing place type", "No history to score it: the AI does not guess; a dispatcher must classify it", "Quarantined"],
  ["Impossible date (e.g. 31/02) or no date", "Cannot be put on a shift", "Quarantined"],
  ["Same order twice on the same day", "Later copy set aside (an order on a later day is a re-attempt, not a duplicate)", "Quarantined"],
  ["No rider", "The dispatcher must assign one", "Quarantined"],
  [`More than ${MAX_ROWS.toLocaleString()} rows`, "First batch processed; the rest is listed as not processed", "Not processed"],
];

async function readFile(file: File): Promise<{ rows: unknown[][]; sheet: string | null; all: { sheet: string; data: unknown[][] }[] }> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv") || name.endsWith(".txt")) return { rows: parseCsv(await file.text()), sheet: null, all: [] };
  if (name.endsWith(".xls")) throw new Error("Old .xls files are not supported. In Excel choose File › Save As › Excel Workbook (.xlsx) or CSV.");
  const { default: readXlsxFile } = await import("read-excel-file/browser");
  const sheets = await readXlsxFile(file);
  // Pick the sheet whose first rows look most like delivery data.
  let best = sheets[0];
  let bestScore = -1;
  for (const s of sheets) {
    const test = parseTable(s.data as unknown[][], file.name, s.sheet);
    const score = test.ok ? test.batch.summary.rowsRead : -1;
    if (score > bestScore) {
      best = s;
      bestScore = score;
    }
  }
  return { rows: (best?.data ?? []) as unknown[][], sheet: best?.sheet ?? null, all: sheets.map((x) => ({ sheet: x.sheet, data: x.data as unknown[][] })) };
}

export default function IntakePage() {
  const { state, update } = useDemo();
  const { present } = usePresent();
  const router = useRouter();
  const [batch, setBatch] = React.useState<ImportBatch | null>(() => activeImportBatch());
  const [isActive, setIsActive] = React.useState<boolean>(() => activeImportBatch() !== null);
  const [error, setError] = React.useState<{ text: string; found: string[] } | null>(null);
  const [note, setNote] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [filter, setFilter] = React.useState<RowStatus | "issues">("issues");
  const fileRef = React.useRef<HTMLInputElement>(null);

  const [allSheets, setAllSheets] = React.useState<{ sheet: string; data: unknown[][] }[]>([]);
  const [src, setSrc] = React.useState<{ rows: unknown[][]; fileName: string; sheet: string | null } | null>(null);
  const [detect, setDetect] = React.useState<ColumnDetection | null>(null);
  const [overrides, setOverrides] = React.useState<Partial<Record<Field, number | null>>>({});
  const [purpose, setPurpose] = React.useState<ImportPurpose | null>(null);

  const run = (source: { rows: unknown[][]; fileName: string; sheet: string | null }, ov: Partial<Record<Field, number | null>>, pu: ImportPurpose | null) => {
    const t0 = performance.now();
    const res = parseTable(source.rows, source.fileName, source.sheet, new Date(), ov, pu ?? undefined);
    const ms = Math.round(performance.now() - t0);
    if (!res.ok) {
      setError({ text: res.error, found: res.foundColumns });
      setBatch(null);
      setIsActive(false);
      return;
    }
    setError(null);
    setBatch(res.batch);
    setIsActive(false);
    setNote(`Checked ${res.batch.summary.rowsRead.toLocaleString()} rows in ${ms} ms. Nothing is in the plan yet: review the results, then import.`);
  };

  const check = (rows: unknown[][], fileName: string, sheet: string | null) => {
    const source = { rows, fileName, sheet };
    setSrc(source);
    setDetect(detectColumns(rows));
    setOverrides({});
    setPurpose(null);
    run(source, {}, null);
  };

  const changeMap = (f: Field, v: number | null) => {
    if (!src) return;
    const ov = { ...overrides, [f]: v };
    setOverrides(ov);
    run(src, ov, purpose);
  };

  const changePurpose = (pu: ImportPurpose) => {
    setPurpose(pu);
    if (src) run(src, overrides, pu);
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setNote(null);
    try {
      const { rows, sheet, all } = await readFile(file);
      setAllSheets(all);
      check(rows, file.name, sheet);
    } catch (e) {
      setError({ text: e instanceof Error ? e.message : "The file could not be read.", found: [] });
      setBatch(null);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const doImport = () => {
    if (!batch) return;
    setImported(batch);
    const warn = saveImportedLocal(batch);
    const s = batch.summary;
    update((st) =>
      recordImport(
        st,
        `Imported ${batch.fileName}: ${s.riderDays} rider-days`,
        `${s.rowsRead} rows read · ${s.accepted} accepted · ${s.warning} with warning · ${s.quarantined} quarantined · ${s.notProcessed} not processed · ${s.heavyDays} heavy days`,
      ),
    );
    setIsActive(true);
    setNote(warn ?? `Imported. ${s.riderDays} rider-days are now in the Dispatcher’s rider list, marked “Imported”. Quarantined rows are not planned.`);
  };

  const open = (shiftId: string) => {
    update((st) => selectShift(st, shiftId));
    router.push("/dispatcher");
  };

  const remove = () => {
    setImported(null);
    saveImportedLocal(null);
    update((st) => recordImportRemoved(st));
    setBatch(null);
    setIsActive(false);
    setNote("Imported data removed. The demo riders are unchanged.");
  };

  const s = batch?.summary;
  const order: Record<RowStatus, number> = { quarantined: 0, warning: 1, accepted: 2 };
  const rows = (batch?.rows ?? []).filter((r) => (filter === "issues" ? true : r.status === filter)).sort((a, b) => order[a.status] - order[b.status] || a.row - b.row);
  const shown = rows.slice(0, 300);

  return (
    <div className="space-y-5">
      <Panel>
        <PanelHeader
          title="Data intake"
          note={
            present
              ? "Upload an Excel or CSV file. Every row is checked before planning. Nothing is dropped silently."
              : "Bring orders from an outside Excel (.xlsx) or CSV file. Every row is checked before planning, and nothing is dropped silently: each row is accepted, accepted with a warning, or quarantined for a dispatcher."
          }
        />
        <div className="flex flex-wrap items-center gap-3 px-4 py-4">
          <input ref={fileRef} type="file" accept=".xlsx,.csv,.txt" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} aria-label="Choose an Excel or CSV file" />
          <Button variant="primary" onClick={() => fileRef.current?.click()} disabled={busy}>
            <Upload /> {busy ? "Reading…" : "Upload Excel or CSV"}
          </Button>
          <Button onClick={() => { setAllSheets([]); check(messySampleRows(), "practice-file-fictional.csv", null); }} disabled={busy}>
            <FlaskConical /> Check the practice file
          </Button>
          <Button variant="ghost" onClick={() => downloadText("s-compass-template.csv", toCsvText(templateRows()), "text/csv")}>
            <Download /> Template
          </Button>
          <Button variant="ghost" onClick={() => downloadText("s-compass-practice-file-fictional.csv", toCsvText(messySampleRows()), "text/csv")}>
            <FileSpreadsheet /> Practice file
          </Button>
          {activeImportBatch() ? (
            <Button variant="danger" onClick={remove} className="ml-auto">
              <Trash2 /> Remove imported data
            </Button>
          ) : null}
        </div>
        <Details label="Which columns are needed?" className="border-t border-line px-4 py-3">
        <div className={cn("text-xs leading-5 text-ink-faint", !present && "border-t border-line px-4 py-3")}>
          Needed: <b>delivery_date</b> and <b>location_type</b> (school, office, industrial, gated_facility). Used when present: order_id, rider_id, location_id or location_name, payment_type,
          parcel_type, address_latitude, address_longitude, buyer_address_processing_time_min, attempt_no, delivery_status, attempt_time. Column names from the Shopee case dataset are recognised, plus common
          English and Vietnamese names. The header can be in any of the first 10 rows; for Excel, the sheet that looks most like delivery data is used. The practice file is fictional. Imported data stays in
          this browser only.
        </div>
        </Details>
      </Panel>

      <StepBar step={isActive ? 4 : batch ? 2 : src ? 1 : 0} />

      {allSheets.length > 1 && src ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface px-4 py-2 text-sm">
          <label htmlFor="sheet-pick" className="font-medium">Sheet in this workbook</label>
          <select id="sheet-pick" className="h-8 rounded-md border border-line bg-surface px-2" value={src.sheet ?? ""} onChange={(e) => { const sh = allSheets.find((x) => x.sheet === e.target.value); if (sh) check(sh.data, src.fileName, sh.sheet); }}>
            {allSheets.map((x) => <option key={x.sheet} value={x.sheet}>{x.sheet}</option>)}
          </select>
          <span className="text-xs text-ink-faint">The sheet that looks most like delivery data was chosen first. Changing it re-checks the file.</span>
        </div>
      ) : null}

      {src && detect ? <MappingPanel detect={detect} overrides={overrides} onChange={changeMap} purpose={purpose ?? batch?.purpose ?? "plan"} onPurpose={changePurpose} attention={!!error || detect.ambiguous.length > 0} /> : null}

      {note ? <div className="rounded-lg border border-line bg-surface px-4 py-3 text-sm">{note}</div> : null}

      {error ? (
        <div role="alert" className="rounded-lg border border-bad/30 bg-bad-tint px-4 py-3 text-sm text-bad">
          <div className="font-medium">{error.text}</div>
          {error.found.length ? <div className="mt-1 text-xs">Columns found in the file: {error.found.join(", ")}</div> : null}
          <div className="mt-1 text-xs">Nothing was imported, so the plans are unchanged.</div>
        </div>
      ) : null}

      {batch && s ? (
        <>
          <Panel>
            <PanelHeader
              title={`Check results · ${batch.fileName}${batch.sheet ? ` (sheet “${batch.sheet}”)` : ""}`}
              note={isActive ? "Imported: these rider-days are in the Dispatcher." : "Checked only: not in the plan yet."}
              actions={
                isActive ? (
                  <Badge tone="ok">Imported</Badge>
                ) : (
                  <Button variant="primary" size="sm" onClick={doImport} disabled={s.riderDays === 0}>
                    Import {s.riderDays} rider-day{s.riderDays === 1 ? "" : "s"}
                  </Button>
                )
              }
            />
            {present ? (
              <div className="grid gap-3 px-4 py-4 sm:grid-cols-3">
                <BigBox tone="ok" label="Accepted" value={s.accepted} sub="no problem found" />
                <BigBox tone="warn" label="Accepted with warning" value={s.warning} sub="planned with a safe fallback" />
                <BigBox tone="bad" label="Needs dispatcher" value={s.quarantined} sub="quarantined, not planned" />
                <p className="text-sm text-ink-soft sm:col-span-3">
                  {s.rowsRead.toLocaleString()} rows read → {s.riderDays} rider-day{s.riderDays === 1 ? "" : "s"}
                  {s.heavyDays ? `, ${s.heavyDays} heavy` : ""}
                  {s.notProcessed ? ` · ${s.notProcessed.toLocaleString()} rows not processed (batch limit)` : ""}
                </p>
              </div>
            ) : null}
            <div className={cn("grid grid-cols-2 gap-4 px-4 py-3 sm:grid-cols-3 lg:grid-cols-6", present && "hidden")}>
              <Stat label="Rows read" value={s.rowsRead.toLocaleString()} sub={s.notProcessed ? `${s.notProcessed.toLocaleString()} not processed` : "all rows checked"} />
              <Stat label="Accepted" value={s.accepted.toLocaleString()} sub="no problem found" />
              <Stat label="Accepted with warning" value={s.warning.toLocaleString()} sub="planned, with a safe fallback" />
              <Stat label="Quarantined" value={s.quarantined.toLocaleString()} sub="not planned, dispatcher decides" />
              <Stat label="Rider-days" value={s.riderDays.toLocaleString()} sub={`${s.heavyDays} heavy (> ${HEAVY_DAY_PARCELS} parcels)`} />
              <Stat label="Places" value={s.places.toLocaleString()} sub="new cards, unverified" />
            </div>
            <div className="border-t border-line px-4 pt-3">
              <div className="flex h-3 w-full overflow-hidden rounded-full bg-line/60" role="img" aria-label={`${s.accepted} accepted, ${s.warning} accepted with warning, ${s.quarantined} need a dispatcher, out of ${s.rowsRead} rows`}>
                {s.accepted ? <div className="sc-grow h-full bg-ok" style={{ width: `${(s.accepted / s.rowsRead) * 100}%` }} /> : null}
                {s.warning ? <div className="sc-grow h-full bg-warn" style={{ width: `${(s.warning / s.rowsRead) * 100}%`, ["--d" as string]: "0.1s" }} /> : null}
                {s.quarantined ? <div className="sc-grow h-full bg-bad" style={{ width: `${(s.quarantined / s.rowsRead) * 100}%`, ["--d" as string]: "0.2s" }} /> : null}
              </div>
              <p className="mt-1 text-xs text-ink-faint">
                <span className="text-ok">■</span> accepted {s.accepted} · <span className="text-warn">■</span> accepted with warning {s.warning} · <span className="text-bad">■</span> needs dispatcher {s.quarantined} · total {s.rowsRead.toLocaleString()} rows
              </p>
            </div>
            <div className="grid gap-x-6 gap-y-1 border-t border-line px-4 py-3 text-sm sm:grid-cols-2">
              <p><b>{(s.eligible ?? s.accepted + s.warning).toLocaleString()}</b> of {s.rowsRead.toLocaleString()} rows can be scored and planned. {s.quarantined.toLocaleString()} wait for a dispatcher (not planned, never deleted).</p>
              <p><b>{(s.noPin ?? 0).toLocaleString()}</b> planned rows have no usable map pin: they stay in the plan and in the list, but are not drawn on the map.</p>
              <p><b>{(s.attemptUnknown ?? 0).toLocaleString()}</b> planned rows have “attempt status unknown”: the app does not assume a first attempt.</p>
              <p>Purpose: <b>{batch.purpose === "replay" ? "replay past data (results shown for comparison only)" : "plan these orders (results in the file are not used)"}</b>. Accepted + warning + quarantined = rows read.</p>
            </div>
            {batch.fileNotes.length ? (
              <ul className="space-y-1 border-t border-line px-4 py-3 text-sm text-warn">
                {batch.fileNotes.map((n) => (
                  <li key={n}>• {n}</li>
                ))}
              </ul>
            ) : null}
            <div className={cn("border-t border-line px-4 py-2 text-xs text-ink-faint", present && "hidden")}>
              <SourceTag kind="live" /> Columns used:{" "}
              {Object.entries(batch.columns)
                .map(([f, c]) => `${c} → ${f}`)
                .join(" · ")}
            </div>
          </Panel>

          <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
            <Panel>
              <PanelHeader
                title="Rows that need attention"
                note={`${batch.rows.length.toLocaleString()} rows have a warning or were quarantined. Rows with no problem are not listed.`}
                actions={
                  <div className="inline-flex rounded-lg border border-line p-0.5 text-xs">
                    {(["issues", "warning", "quarantined"] as const).map((f) => (
                      <button key={f} onClick={() => setFilter(f)} className={`rounded-md px-2.5 py-1 ${filter === f ? "bg-ink text-white" : "text-ink-soft"}`}>
                        {f === "issues" ? "All" : STATUS_LABEL[f]}
                      </button>
                    ))}
                  </div>
                }
              />
              <div className="max-h-[560px] overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-canvas text-left text-xs text-ink-faint">
                    <tr>
                      <th className="px-3 py-2">Row</th>
                      <th className="px-3 py-2">Order</th>
                      <th className="px-3 py-2">Rider · date</th>
                      <th className="px-3 py-2">Result</th>
                      <th className="px-3 py-2">What S-Compass did</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((r) => (
                      <tr key={r.row} className="border-t border-line align-top">
                        <td className="px-3 py-2 tabular-nums text-ink-faint">{r.row}</td>
                        <td className="whitespace-nowrap px-3 py-2 font-medium">{r.orderId}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-ink-soft">
                          {r.riderId} · {r.date || "—"}
                        </td>
                        <td className="px-3 py-2">
                          <Badge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                        </td>
                        <td className="px-3 py-2 text-ink-soft">{r.issues.join(" · ")}</td>
                      </tr>
                    ))}
                    {shown.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-3 py-6 text-center text-ink-faint">
                          No rows in this group.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
                {rows.length > shown.length ? <div className="px-3 py-2 text-xs text-ink-faint">Showing the first {shown.length} of {rows.length.toLocaleString()} rows.</div> : null}
              </div>
            </Panel>

            <Panel>
              <PanelHeader title="Rider-days created" note={isActive ? "Open one to plan it with the same AI scorer and rules." : "Import first, then open a rider-day in the Dispatcher."} />
              <ul className="max-h-[560px] divide-y divide-line overflow-auto">
                {batch.shiftInfo.map((x) => (
                  <li key={x.shiftId} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                    <div>
                      <div className="font-medium">{x.riderLabel}</div>
                      <div className="text-xs text-ink-faint">
                        {x.weekday} {x.date} · {x.parcels} parcels {x.heavy ? <Badge tone="warn">Heavy day</Badge> : null}
                      </div>
                    </div>
                    <Button size="sm" onClick={() => open(x.shiftId)} disabled={!isActive}>
                      Open
                    </Button>
                  </li>
                ))}
                {batch.shiftInfo.length === 0 ? <li className="px-4 py-6 text-center text-sm text-ink-faint">No rider-day could be built: every row was quarantined.</li> : null}
              </ul>
            </Panel>
          </div>
        </>
      ) : null}

      <Panel>
        <PanelHeader title="How each problem is handled" note="S-Compass never guesses missing information. It uses a stated fallback, asks the buyer, or hands the row to a dispatcher." />
        <Details label="Show all 13 rules" className="px-4 py-3">
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-canvas text-left text-xs text-ink-faint">
              <tr>
                <th className="px-4 py-2">Problem in the file</th>
                <th className="px-4 py-2">What S-Compass does</th>
                <th className="px-4 py-2">Result</th>
              </tr>
            </thead>
            <tbody>
              {RULES.map(([a, b, c]) => (
                <tr key={a} className="border-t border-line align-top">
                  <td className="px-4 py-2 font-medium">{a}</td>
                  <td className="px-4 py-2 text-ink-soft">{b}</td>
                  <td className="px-4 py-2">{c}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </Details>
        <div className="border-t border-line px-4 py-2 text-xs text-ink-faint">
          Session: {state.sessionId.slice(-6)} · every import and removal is written to the Evidence log.
        </div>
      </Panel>
    </div>
  );
}

function BigBox({ tone, label, value, sub }: { tone: "ok" | "warn" | "bad"; label: string; value: number; sub: string }) {
  const c = { ok: "border-ok/40 bg-ok-tint text-ok", warn: "border-warn/40 bg-warn-tint text-warn", bad: "border-bad/40 bg-bad-tint text-bad" }[tone];
  return (
    <div className={cn("rounded-xl border px-4 py-3", c)}>
      <div className="text-sm font-semibold">{label}</div>
      <div className="text-4xl font-semibold leading-tight">{value.toLocaleString()}</div>
      <div className="text-xs opacity-90">{sub}</div>
    </div>
  );
}

const STEPS = ["Upload", "Match columns", "Review", "Import", "Generate plan"];

function StepBar({ step }: { step: number }) {
  // 0 nothing yet, 1 file read but not checked, 2 checked (review), 4 imported.
  const at = step === 0 ? 0 : step === 1 ? 1 : step === 2 ? 2 : 4;
  return (
    <ol className="flex flex-wrap gap-2 text-sm" aria-label="Import steps">
      {STEPS.map((x, i) => (
        <li key={x} className={cn("rounded-full border px-3 py-1", i < at ? "border-ok/40 bg-ok-tint text-ok" : i === at ? "border-brand bg-brand-tint text-brand-ink font-medium" : "border-line text-ink-faint")}>
          {i + 1}. {x}
        </li>
      ))}
    </ol>
  );
}

const NEED_LABEL = { required: "Required", scoring: "Used for the estimate", optional: "Optional", results: "Past results only" } as const;

function MappingPanel({ detect, overrides, onChange, purpose, onPurpose, attention }: { detect: ColumnDetection; overrides: Partial<Record<Field, number | null>>; onChange: (f: Field, v: number | null) => void; purpose: ImportPurpose; onPurpose: (p: ImportPurpose) => void; attention: boolean }) {
  const fields = Object.keys(FIELD_INFO) as Field[];
  const current = (f: Field): number | null => (f in overrides ? (overrides[f] ?? null) : (detect.map[f] ?? null));
  const body = (
    <div className="space-y-4">
      <p className="text-sm text-ink-soft">
        The app matched the file’s columns to its fields by name (English and Vietnamese). Change a match if it is wrong. The file is converted inside the app: you do not need our workbook.
      </p>
      {detect.ambiguous.length ? (
        <p className="rounded-md bg-warn-tint px-3 py-2 text-sm text-warn">
          More than one column fits: {detect.ambiguous.map((f) => FIELD_INFO[f].label).join(", ")}. Please confirm the right one below.
        </p>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-ink-faint">
              <th className="py-1 pr-3">App field</th>
              <th className="py-1 pr-3">Column in your file</th>
              <th className="py-1">If there is no column</th>
            </tr>
          </thead>
          <tbody>
            {fields.map((f) => {
              const info = FIELD_INFO[f];
              const cur = current(f);
              return (
                <tr key={f} className="border-b border-line/60 align-top">
                  <td className="py-1.5 pr-3">
                    <span className="font-medium">{info.label}</span> <span className="text-xs text-ink-faint">· {NEED_LABEL[info.need]}</span>
                    {detect.ambiguous.includes(f) ? <Badge tone="warn">Confirm</Badge> : null}
                  </td>
                  <td className="py-1.5 pr-3">
                    <select
                      aria-label={`Column for ${info.label}`}
                      className="h-8 w-full max-w-[16rem] rounded-md border border-line bg-surface px-2 text-sm"
                      value={cur === null ? "" : String(cur)}
                      onChange={(e) => onChange(f, e.target.value === "" ? null : Number(e.target.value))}
                    >
                      <option value="">— no such column —</option>
                      {detect.header.map((h, i) => (h ? <option key={i} value={i}>{h}</option> : null))}
                    </select>
                  </td>
                  <td className="py-1.5 text-xs text-ink-faint">{cur === null ? info.ifMissing : ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div>
        <p className="mb-1 text-sm font-medium">What is this file for?</p>
        <div className="flex flex-wrap gap-2">
          {([
            ["plan", "Plan these orders", "Deliveries to plan. Result columns are ignored, because they are not known before delivery."],
            ["replay", "Replay past data", "Old deliveries. Results are shown for comparison and never change the scorer."],
          ] as [ImportPurpose, string, string][]).map(([v, label, sub]) => (
            <label key={v} className={cn("flex max-w-xs cursor-pointer gap-2 rounded-lg border px-3 py-2 text-sm", purpose === v ? "border-brand bg-brand-tint" : "border-line")}>
              <input type="radio" name="purpose" checked={purpose === v} onChange={() => onPurpose(v)} className="mt-1" />
              <span>
                <span className="font-medium">{label}</span>
                <span className="block text-xs text-ink-faint">{sub}</span>
              </span>
            </label>
          ))}
        </div>
        <p className="mt-1 text-xs text-ink-faint">Importing never retrains or changes the success table.</p>
      </div>
      {detect.preview.length ? (
        <div className="overflow-x-auto">
          <p className="mb-1 text-xs text-ink-faint">First rows of the file (header is row {detect.headerIndex + 1})</p>
          <table className="text-xs">
            <thead>
              <tr>{detect.header.map((h, i) => <th key={i} className="border-b border-line px-2 py-1 text-left font-medium">{h}</th>)}</tr>
            </thead>
            <tbody>
              {detect.preview.map((r, i) => (
                <tr key={i}>{r.map((c, j) => <td key={j} className="border-b border-line/60 px-2 py-1">{c}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
  return (
    <Panel>
      <PanelHeader title="2. Match the columns" note="Check how your file’s columns map to the app" />
      <div className="px-4 py-3">{attention ? body : <Details label="Check or change the column matches">{body}</Details>}</div>
    </Panel>
  );
}
