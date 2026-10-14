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

Same parcels, same rider, scored with the same history table:

| Shift | Baseline (nearest pin) | Rules | Model (exp.) |
|---|---|---|---|
| Wed 14 Oct, 37 parcels | 28.2 | 30.5 | 30.9 |
| Sat 10 Oct, 33 parcels | 20.4 | 23.0 | 22.3 |

The actual dataset outcome on those rider-days: 29 of 37 and 22 of 33 attempts delivered. Times, distances and entrance-search minutes are assumptions listed on the How it works page.
