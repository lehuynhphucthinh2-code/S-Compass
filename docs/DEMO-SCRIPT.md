# 2-minute video script

Record on the deployed link (the same one you submit). Before recording: press **Reset demo**, set **Tester** to your team code, use a 1440 px wide browser window, and open Chrome DevTools device mode (iPhone 12 size) for the rider part. Practise twice; the timings below add up to about 1:55.

| Time | Screen | Do | Say (simple English) |
|---|---|---|---|
| 0:00–0:12 | Dispatcher | Show the header and the three panels | "S-Compass helps new riders use the know-how of veterans. Every number on this page says where it comes from: dataset, simulated or live." |
| 0:12–0:30 | Dispatcher | Point at Dataset history, then Generate plan with **Baseline** | "In the dataset, first-attempt success is 72.7%. Schools and offices fail most in the evening. Today's app just follows the nearest pin — 7 stops land in low-chance blocks." |
| 0:30–0:45 | Dispatcher | Compare plans → Use rules → Dispatch to rider | "Input: 37 loaded parcels and stop cards. Processing: the rules planner picks each stop's best block from the history table and checks time capacity. Output: expected successful first attempts rise from 28.2 to 30.5 — a simulated estimate." |
| 0:45–1:05 | Rider (phone) | Next stop, Why this stop now, Open stop card | "The rider sees the next stop, why it is next, the suggested entrance and handover. A dataset pin is not a verified entrance — the card shows how far the pins for this site spread." |
| 1:05–1:20 | Rider → Stop cards | Suggest correction (receiving window) → switch role to Dispatcher → Approve | "The rider sends a correction. Only after the dispatcher approves does the card become verified and change the next plan." |
| 1:20–1:38 | Buyer simulation | Pick a flagged order → Send confirmation request → Ask for morning | "Risky orders get Buyer Confirm. The buyer moves the window; no real message is sent. If the buyer does not answer, the order is not cancelled." |
| 1:38–1:50 | Replanning | Show previous vs proposed sequence → Accept new plan | "Live replanning shows what changed, why, and which commitments are affected. Completed stops stay fixed; moving a parcel to another rider needs an explicit action." |
| 1:50–2:00 | Evidence | Show metrics and Export CSV | "Every interaction is logged with tester and persona and can be exported as test evidence." |

Optional if time allows: the How it works page verdict — "On this data, our learned model did not beat the simple rules table, so the prototype runs on rules; the pilot tests AI against rules."

## Test sessions with peers or mock personas

1. In the header, click **Tester** and enter a code (e.g. `Peer-03`) and a persona.
2. Give the tester one task, for example: "You are a new rider. Find where to hand over the parcel at the next stop and report that the main gate is closed until 13:00."
3. Do not help. Note time and problems with **Evidence → Tester note**.
4. After each session, **Export CSV**. Keep the files for the proposal appendix (or use Supabase and `supabase/useful-queries.sql`).
5. Press **Reset demo** before the next tester.
