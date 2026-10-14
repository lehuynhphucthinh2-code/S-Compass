# S-Compass prototype

S-Compass is the Business Challenge 2026 prototype from team BCE004 (Watt the hedge). It helps delivery riders and hub dispatchers use shared local knowledge to make better delivery decisions.

It is a competition prototype, not an official Shopee product. Buyer and place names are fictional.

## What you can do in the app

| Screen | What it shows |
|---|---|
| Dispatcher | Pick a demo shift, generate a plan with three methods (Baseline, Rules-based, Model experimental), compare them, dispatch one, move a parcel to another rider |
| Rider (mobile) | Next recommended stop, why it is next, ordered remaining stops, Open stop card, Report issue, Record outcome |
| Stop cards | The Stop Knowledge Map: entrance, handover, access rules, receiving windows, source, last verification date, status (unverified, suggested, verified, disputed), corrections to approve |
| Buyer simulation | Act as a buyer: confirm a window, ask for another window, pick a pickup point, or leave the message unanswered |
| Replanning | Two demo events (buyer changes window, entrance unavailable), previous vs proposed sequence, reasons, affected commitments, accept or override |
| Evidence | Every real interaction in the session, with metrics and CSV/JSON export |
| How it works | Input → processing → output, the decision rules, the model test results, failure modes and all assumptions |

Every plan is computed by real code in `src/lib/` (no hard-coded results). The UI separates three kinds of numbers: **Dataset** (historical facts), **Simulated** (plan estimates) and **Live demo** (what you did in this session).

## Run it on your computer (Stage 1, no accounts needed)

1. Install **Node.js 20 or newer** from https://nodejs.org (choose the LTS version).
2. Open a terminal in this folder. On Windows: open the folder, type `cmd` in the address bar and press Enter.
3. Install the packages (only the first time):
   ```
   npm install
   ```
4. Start the app:
   ```
   npm run dev
   ```
5. Open http://localhost:3000 in your browser.

The app starts in **Demo Mode**. Everything is saved in your browser. Use **Reset demo** in the header to go back to the original data.

Other useful commands:

```
npm test          # runs the logic tests (planner, model parity, privacy check)
npm run build     # checks that the production build works (Vercel runs this too)
```

## Folder guide

```
src/app/            the screens (Next.js App Router)
src/components/     shared UI parts (stop card, map, timeline, plan change view)
src/lib/            the logic layer: planner, history table, model, replanning, evidence, persistence
src/data/           de-identified data built from the competition dataset (safe to publish)
scripts/            Python scripts that build src/data/ from the dataset and train/test the model
supabase/           SQL for the optional Supabase database (Stage 2)
docs/               deployment guide, 2-minute video script, data findings
data-private/       put the raw dataset here; this folder is NOT uploaded to GitHub
```

## Data and privacy

The raw dataset is **not** inside the website. `scripts/build_data.py` creates aggregate tables, model coefficients and two de-identified demo shifts. It removes order, buyer, location and rider IDs, uses fictional names, and turns map pins into rotated local metres, so no latitude or longitude is published. A test (`npm test`) checks this.

To rebuild the data (only needed if the dataset changes):

```
pip install pandas numpy scikit-learn openpyxl
npm run data
```

## Stage 2: Supabase (optional)

Without Supabase the app works fully in Demo Mode. With Supabase, sessions and evidence events are also stored in a database, so you can collect test logs from several testers. See `docs/DEPLOYMENT.md`, section "Supabase". If Supabase is configured but a save fails, the app shows a red message and says the change is only kept in the browser. It never claims a save that did not happen.

## Stage 3: put it online

See `docs/DEPLOYMENT.md` for step-by-step GitHub and Vercel instructions and a checklist. Note: the competition does not allow changes to the prototype after the submission deadline, so deploy, record the video and submit from the same version.

## Licences

Code: written for this competition. Font: IBM Plex Sans (SIL Open Font License, via `@fontsource/ibm-plex-sans`). Icons: Lucide (ISC).
