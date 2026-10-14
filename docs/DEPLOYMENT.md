# Deployment guide (GitHub + Vercel, optional Supabase)

This guide assumes no developer experience. Follow the steps in order. Nothing here has been deployed for you yet.

## 1. Put the code on GitHub

1. Create a free account at https://github.com.
2. Click **New repository**. Name it `s-compass-prototype`. Choose **Private** (recommended) or Public. Do not add a README (the project has one). Click **Create repository**.
3. Install Git from https://git-scm.com if you do not have it.
4. Open a terminal in the project folder and run these commands one by one (replace `YOUR-NAME`):
   ```
   git init
   git add .
   git commit -m "S-Compass prototype"
   git branch -M main
   git remote add origin https://github.com/YOUR-NAME/s-compass-prototype.git
   git push -u origin main
   ```
5. Check on GitHub that the folder `data-private` only contains `README.md`. The raw dataset must **not** be there. (`.gitignore` already blocks it.)

Easier option: install **GitHub Desktop** (https://desktop.github.com), choose *File → Add local repository*, select the folder, then *Publish repository*.

## 2. Deploy on Vercel

1. Go to https://vercel.com and sign up with your GitHub account.
2. Click **Add New… → Project** and import `s-compass-prototype`.
3. Vercel detects **Next.js** automatically. Keep the default settings:
   - Build command: `npm run build`
   - Install command: `npm install`
   - Node.js version (Settings → General): 20.x or 22.x
4. Environment variables: leave them empty for Demo Mode. (Add the Supabase ones only if you finish section 3.)
5. Click **Deploy**. After about one minute you get a link like `https://s-compass-prototype.vercel.app`.
6. Open the link on a laptop and on a phone. Check every item in the checklist below.

Every new `git push` creates a new deployment. **After the submission deadline, do not push again** — the rules say the prototype link must match the video.

## 3. Supabase (optional, Stage 2)

Use this only if you want test logs from several testers in one database.

1. Create a free project at https://supabase.com. Pick a region close to Vietnam (Singapore).
2. Open **SQL Editor → New query**, paste the content of `supabase/migrations/0001_init.sql`, and click **Run**.
3. Optional: run `supabase/seed.sql` to add one test row, then check **Table Editor → demo_sessions**.
4. Open **Project Settings → API** and copy:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - anon public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. Local test: copy `.env.example` to `.env.local`, paste the two values, run `npm run dev`. The header badge changes from **Demo Mode** to **Supabase**.
6. Vercel: **Settings → Environment Variables**, add the same two variables for *Production*, then **Redeploy**.
7. After a test session, run the queries in `supabase/useful-queries.sql` to count events per tester.

Security note: the anon key is public by design and the policies are demo-grade, so anyone with the site can write to these two tables. Do not store personal data. Delete the Supabase project after the competition.

If Supabase is down or the keys are wrong, the app keeps working from the browser copy and shows a red message "Not saved to Supabase: …". That is expected and honest behaviour.

## 4. Deployment checklist

- [ ] `npm test` passes and `npm run build` finishes without errors on your computer.
- [ ] `data-private/` on GitHub contains only `README.md`.
- [ ] The Vercel link opens on desktop and phone; the header shows **Demo Mode** (or **Supabase** if configured) and **Competition prototype**.
- [ ] Dispatcher: Generate plan, Compare plans and Dispatch to rider all work.
- [ ] Rider (phone): Open stop card, Report issue and Record outcome work.
- [ ] Stop cards: a rider correction appears in "Corrections to review"; approving it (role Dispatcher) changes the status to Verified.
- [ ] Buyer simulation: confirm, change window, pickup and leave unanswered all work; "no response" does not cancel the order.
- [ ] Replanning: both demo events create a proposal; Accept and Keep current plan both work.
- [ ] Evidence: CSV and JSON export download.
- [ ] Reset demo returns to the original data.
- [ ] Record the 2-minute video (docs/DEMO-SCRIPT.md) on the **same deployed link** you submit.
- [ ] File names follow the rules, e.g. `[BC26] - [BCE004] - [Prototype Video]`.
- [ ] No more pushes after 20:00, 17/10/2026 (GMT+7).
