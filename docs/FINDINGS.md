# Data findings behind the prototype

Source: Business Challenge 2026 Strategy Round dataset, 8,059 attempt rows, 6,047 orders, 1 Sep – 15 Oct 2026, 6 rider zones in Ho Chi Minh City. All figures below were computed by `scripts/build_data.py` and `scripts/train_eval.py`.

## 1. The dataset reproduces the case KPIs

| KPI | Dataset | Case target |
|---|---|---|
| First-attempt success | 72.7% | 88% |
| Re-delivery rate | 26.4% | 10.5% |
| Return rate | 2.9% | 1.5% |
| Final success rate | 97.1% | 98.5% |
| Average attempts | 1.33 | 1.1 |

## 2. When a stop is attempted matters most (first attempts)

| Site type | Morning | Afternoon | Evening |
|---|---|---|---|
| School | 81.7% | 73.6% | 43.8% |
| Office | 70.9% | 71.5% | 43.1% |
| Industrial | 56.3% | 85.3% | 89.9% |
| Gated site | 84.8% | 86.4% | 82.0% |

- Offices at the weekend: 26.7% vs 72.3% on weekdays.
- COD: 68.5% vs prepaid 75.0%.
- 19.9% of orders have no map pin (70.5% vs 73.3% success).
- Notes such as "Guard: parcels accepted in office hours only" appear on 446 first attempts with 45.3% success.
- Pins for one site spread on average 240 m around the successful drop-off point, so a coordinate is not an entrance.

## 3. AI versus rules on this data (holdout 1–15 Oct, 2,565 attempts)

| Method | AUC | Brier score |
|---|---|---|
| Overall rate | 0.500 | 0.189 |
| History table (rules planner) | 0.723 | 0.158 |
| Logistic regression | 0.711 | 0.163 |
| Gradient boosting | 0.729 | 0.161 |

Conclusion: the simple history table (site type × block × weekday/weekend × payment) is as good as the learned models. A site's own history adds almost nothing beyond its type. The prototype therefore uses a **rules-based planner**, shows the model planner as **experimental**, and the proposal should test AI against rules in the pilot with richer data (arrival timestamps, verified entrances, buyer replies, real travel times).

Observational check (not causal): attempts made in the block the rules would choose succeeded 83.8% of the time (865 attempts) vs 70.3% otherwise.

## 4. Simulated plan estimates in the demo (not measured results)

Expected successful first attempts for the same parcels, same rider and same start, scored with the same history table. "Actual" is what really happened on that rider-day in the dataset (attempts delivered).

| Rider (zone) | Shift | Parcels | Actual | Baseline (nearest pin) | Rules | Model (exp.) |
|---|---|---|---|---|---|---|
| A · Minh | Wed 14 Oct | 37 | 29 | 28.2 | 30.5 | 30.9 |
| A · Minh | Sat 10 Oct | 33 | 22 | 20.3 | 23.0 | 22.3 |
| B · An | Wed 14 Oct | 39 | 29 | 28.7 | 32.1 | 33.0 |
| B · An | Sat 10 Oct | 36 | 25 | 23.6 | 24.3 | 23.0 |
| C · Bao | Wed 14 Oct | 34 | 29 | 27.8 | 29.1 | 28.9 |
| C · Bao | Sat 10 Oct | 32 | 23 | 23.1 | 26.0 | 25.5 |
| D · Chi | Wed 14 Oct | 43 | 33 | 31.2 | 34.0 | 33.3 |
| D · Chi | Sat 10 Oct | 36 | 24 | 22.4 | 23.1 | 22.0 |
| E · Duy | Wed 14 Oct | 39 | 31 | 30.6 | 33.2 | 32.5 |
| E · Duy | Sat 10 Oct | 36 | 26 | 26.3 | 26.9 | 25.5 |
| F · Giang | Wed 14 Oct | 42 | 33 | 32.5 | 36.0 | 35.4 |
| F · Giang | Sat 10 Oct | 32 | 22 | 20.1 | 23.3 | 21.5 |

The rules planner beats the distance-only baseline on all 12 rider-days. The experimental model beats rules on only 2 of 12. On Saturday the gain is small in zones B, D and E (under 1 expected delivery), because the morning block fills up and the remaining school and office stops have no good block left; this is where Buyer Confirm and pickup points matter. Several heavy days end after 20:30 even with the rules plan; the app flags this for the dispatcher instead of dropping stops. Times, distances and entrance-search minutes are assumptions listed on the How it works page.
