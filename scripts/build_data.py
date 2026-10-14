"""Build the public data files used by the S-Compass prototype.

Usage (from the project root):
    python3 scripts/build_data.py data-private/strategy_dataset.xlsx

The raw competition dataset stays in data-private/ (git-ignored). This
script writes ONLY aggregated statistics, model coefficients and
de-identified demo fixtures to src/data/:
  - no order IDs, buyer IDs, location IDs or rider IDs
  - fictional buyer and location names
  - map pins converted to local x/y metres after a rotation, so no
    latitude/longitude reaches the website bundle
"""
import json
import math
import random
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).parent))
import train_eval as te  # noqa: E402
from features import LOC_TYPES, WINDOWS, feature_names  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "src" / "data"
DEMO_RIDER = "R06"
# Order matters: R06 first keeps the original demo zone (Rider A) and buyer names unchanged.
RIDERS = [("R06", "A", "Minh"), ("R01", "B", "An"), ("R02", "C", "Bao"), ("R03", "D", "Chi"), ("R04", "E", "Duy"), ("R05", "F", "Giang")]
SHIFT_DATES = [("2026-10-14", "weekday"), ("2026-10-10", "weekend")]
KNOWLEDGE_CUTOFF = te.SPLIT  # knowledge cards use visits before 1 Oct 2026
TABLE_PRIOR = 5.0

# ---------------------------------------------------------------- notes
# Vietnamese raw note phrase -> (English text, kind)
# kind: entrance | handover | restriction | window | issue | payment
PHRASES = [
    (r"^COD – can thu tien mat$", "COD: cash must be collected", "payment"),
    (r"^Bao ve cong chinh$", "Security post at the main gate", "entrance"),
    (r"^can dang ky CCCD khi vao", "ID card registration needed to enter", "restriction"),
    (r"^Khuon vien co bao ve, gui xe ngoai cong$", "Guarded grounds; park outside the gate", "restriction"),
    (r"^Cong phu xe may$", "Side gate for motorbikes", "entrance"),
    (r"^oto khong vao duoc$", "Cars cannot enter", "restriction"),
    (r"^Ban giao tai le tan tang 1$", "Hand over at ground-floor reception", "handover"),
    (r"^Ban giao tai", "Hand over at the named front desk", "handover"),
    (r"^De o quay bao ve, goi buyer xuong nhan$", "Leave at security desk and call the buyer to come down", "handover"),
    (r"^Diem ban giao: sanh chinh$", "Handover point: main lobby", "handover"),
    (r"^Bao ve bao chi nhan trong gio hanh chinh$", "Guard: parcels accepted in office hours only", "window"),
    (r"^Chi nhan hang trong gio hanh chinh$", "Receives in office hours only", "window"),
    (r"^Van phong nghi 12:00–13:30$", "Office lunch break 12:00–13:30", "window"),
    (r"^Chi nhan hang 11:30–13:00 \(ca trua\)$", "Receives only 11:30–13:00 (lunch shift)", "window"),
    (r"^Nhan sau 17:00 khi tan ca$", "Receives after 17:00 (end of work shift)", "window"),
    (r"^Nguoi nhan khong ra duoc buoi toi$", "Recipient cannot come out in the evening", "window"),
    (r"^Cuoi tuan van phong dong$", "Office closed at weekends", "window"),
    (r"^Le tan nghi cuoi tuan$", "Reception closed at weekends", "window"),
    (r"^Ngoai gio hanh chinh$", "Arrived outside office hours", "issue"),
    (r"^le tan da ve$", "Receptionist had left", "issue"),
    (r"^Khong dung cua so nhan hang cua diem$", "Arrived outside the site's receiving window", "issue"),
    (r"^Nguoi nhan khong co mat luc toi diem$", "Recipient absent on arrival", "issue"),
    (r"^khong co nguoi nhan$", "No one available to receive", "issue"),
    (r"^Ngay campaign – hang doi o cong$", "Campaign day: queue at the gate", "issue"),
    (r"^Le tan nghi$", "Reception closed", "issue"),
    (r"^bao ve bao nguoi nhan khong co mat$", "Guard said the recipient was absent", "issue"),
    (r"^Nguoi nhan khong tra loi$", "Recipient did not answer", "issue"),
    (r"^de lai o bao ve khong duoc$", "Guard would not accept the parcel", "issue"),
    (r"^Van phong nghi$", "Office closed", "issue"),
    (r"^thu lai ngay thuong$", "Retry on a weekday", "issue"),
]

# window phrase -> machine-readable restriction used by the planner
WINDOW_RULES = {
    "Guard: parcels accepted in office hours only": {"code": "office_hours", "blocks": ["morning", "afternoon"]},
    "Receives in office hours only": {"code": "office_hours", "blocks": ["morning", "afternoon"]},
    "Receives only 11:30–13:00 (lunch shift)": {"code": "lunch_only", "blocks": ["afternoon"], "latest": "13:00"},
    "Receives after 17:00 (end of work shift)": {"code": "after_17", "blocks": ["evening"]},
    "Recipient cannot come out in the evening": {"code": "no_evening", "blocks": ["morning", "afternoon"]},
    "Office closed at weekends": {"code": "closed_weekend", "weekdaysOnly": True},
    "Reception closed at weekends": {"code": "closed_weekend", "weekdaysOnly": True},
    "Office lunch break 12:00–13:30": {"code": "lunch_break", "info": True},
}


def translate(phrase):
    p = phrase.strip()
    for pat, text, kind in PHRASES:
        if re.search(pat, p):
            return text, kind
    return None, None


def split_notes(raw):
    if not isinstance(raw, str):
        return []
    out = []
    for part in raw.split(";"):
        text, kind = translate(part)
        if text:
            out.append((text, kind))
    return out


# ------------------------------------------------------------ geometry
def make_projector(lat0, lon0, theta=0.61):
    c, s = math.cos(theta), math.sin(theta)

    def proj(lat, lon):
        if lat is None or (isinstance(lat, float) and math.isnan(lat)):
            return None
        x = (lon - lon0) * 111320 * math.cos(math.radians(lat0))
        y = (lat - lat0) * 110540
        return [round(c * x - s * y, 1), round(s * x + c * y, 1)]

    return proj


# ------------------------------------------------------------- names
LOCATION_NAMES = {
    "school": ["Hoa Sen Vocational College", "Mai Anh Primary School", "Truc Lam Secondary School",
               "Ngoc Lan Kindergarten", "Thanh Tam High School"],
    "office": ["Kim Long Trading Office", "An Phu Insurance Branch"],
    "industrial": ["Song Xanh Garment Factory", "Phu Thinh Electronics Plant", "Tan Hiep Packaging Works"],
    "gated_facility": ["Binh An Clinic (gated campus)"],
}
PLACE_WORDS = ["Hong Phat", "Bao Ngoc", "Thien Phuc", "Minh Tri", "Phuong Nam", "Kim Son", "Hai Dang", "Tan Phu", "Lac Viet",
               "Sao Mai", "Hoa Mai", "Truong An", "Viet Tien", "Nam Long", "Duc Tri", "Gia Hoa", "Thanh Binh", "Phu An",
               "Hung Thinh", "Quang Minh", "Tuong Lai", "Anh Duong", "Song Hong", "Hoang Kim", "Dai Phat", "Binh Minh",
               "Thuan Phat", "Ngoc Diep", "Bach Viet", "Trung Son", "An Khang", "Huong Sen", "Cat Tuong", "Phuc Loc",
               "Van Xuan", "Dong Tam", "Tri Duc", "Hai Au", "Thao Nguyen", "Vinh Hung"]
PLACE_SUFFIX = {
    "school": ["Primary School", "Secondary School", "High School", "Kindergarten", "Vocational College", "Language Centre"],
    "office": ["Trading Office", "Insurance Branch", "Bank Branch", "Logistics Office", "Ward Office"],
    "industrial": ["Garment Factory", "Electronics Plant", "Packaging Works"],
    "gated_facility": ["Clinic (gated campus)", "Pharmacy (guarded lot)", "Residence (gated)", "Hotel (security desk)", "Mall (staff gate)"],
}
PICKUP_NAMES = [["Thu Ha Grocery", "Minh Chau Stationery"], ["Lan Anh Mini Mart", "Phuc An Bookshop"], ["Hoa Binh Grocery", "Kim Ngan Copy Shop"],
                ["Tuan Phat Mini Mart", "Ngoc Mai Stationery"], ["Bich Thuy Grocery", "Thanh Dat Phone Shop"], ["Song Tra Mini Mart", "Hai Yen Stationery"]]
FAMILY = ["Nguyen", "Tran", "Le", "Pham", "Hoang", "Vu", "Dang", "Bui", "Do", "Ho", "Ngo", "Duong", "Ly"]
MIDDLE = ["Van", "Thi", "Minh", "Ngoc", "Gia", "Thanh", "Duc", "Bao", "Kim", "Quoc"]
GIVEN = ["An", "Binh", "Chi", "Dung", "Giang", "Ha", "Hieu", "Khanh", "Lan", "Linh", "Long", "Mai", "Nam",
         "Nhi", "Phuc", "Quan", "Tam", "Thao", "Trang", "Tuan", "Uyen", "Vy", "Yen", "Khoa", "Hanh", "Son"]


def r4(x):
    return None if x is None else round(float(x), 4)


def main(path):
    out = te.run(path)
    df = out["df"]
    rng = random.Random(2026)

    # ------------------------------------------------ historical stats (full dataset)
    full = df.sort_values(["order_id", "delivery_date"])
    g = full.groupby("order_id")
    attempts = g.size()
    first = g.first()
    final = g.delivery_status.last()
    first_ok = (first.delivery_status == "delivered")
    weekend_first = first.delivery_date.dt.dayofweek >= 5

    def rate_table(frame, keys):
        rows = []
        for k, sub in frame.groupby(keys):
            k = k if isinstance(k, tuple) else (k,)
            rows.append({**{key: (bool(v) if isinstance(v, (bool, np.bool_)) else str(v)) for key, v in zip(keys, k)},
                         "n": int(len(sub)), "success": r4(sub.ok_first.mean())})
        return rows

    fr = first.copy()
    fr["ok_first"] = first_ok.astype(int)
    fr["weekend"] = weekend_first
    fr["has_pin"] = fr.address_latitude.notna()
    fr["service_band"] = pd.cut(fr.buyer_address_processing_time_min, [0, 10, 20, 30],
                                labels=["≤10 min", "11–20 min", "21–30 min"]).astype(str)

    phrase_counter, phrase_ok = Counter(), Counter()
    for raw, ok in zip(fr.access_context_raw, fr.ok_first):
        for text, kind in split_notes(raw):
            phrase_counter[(text, kind)] += 1
            phrase_ok[(text, kind)] += ok

    historical = {
        "source": "Business Challenge 2026 Strategy Round dataset (AI in E-commerce)",
        "period": {"from": str(df.delivery_date.min().date()), "to": str(df.delivery_date.max().date())},
        "rows": int(len(df)), "orders": int(len(first)), "riderZones": int(df.rider_id.nunique()),
        "locations": int(df.location_id.nunique()),
        "kpis": {
            "firstAttemptSuccess": r4(first_ok.mean()),
            "redeliveryRate": r4((attempts > 1).mean()),
            "returnRate": r4((final == "returned").mean()),
            "finalSuccessRate": r4((final == "delivered").mean()),
            "avgAttempts": r4(attempts.mean()),
        },
        "caseTargets": {"firstAttemptSuccess": 0.88, "redeliveryRate": 0.105, "returnRate": 0.015,
                        "finalSuccessRate": 0.985, "avgAttempts": 1.1},
        "byWindow": rate_table(fr, ["attempt_time"]),
        "byTypeWindow": rate_table(fr, ["location_type", "attempt_time"]),
        "byTypeDay": rate_table(fr, ["location_type", "weekend"]),
        "byPayment": rate_table(fr, ["payment_type"]),
        "byParcel": rate_table(fr, ["parcel_type"]),
        "byPin": rate_table(fr, ["has_pin"]),
        "byServiceBand": [r for r in rate_table(fr, ["service_band"]) if r["service_band"] != "nan"],
        "missingPinShare": r4(1 - fr.has_pin.mean()),
        "missingServiceTimeShare": r4(fr.buyer_address_processing_time_min.isna().mean()),
        "noteFrequency": sorted([{"note": k[0], "kind": k[1], "n": int(v), "success": r4(phrase_ok[k] / v)}
                                 for k, v in phrase_counter.items()], key=lambda r: -r["n"]),
        "definitions": {
            "firstAttemptSuccess": "Orders delivered on their first attempt ÷ all orders (first row of each order).",
            "redeliveryRate": "Orders with more than one attempt ÷ all orders.",
            "returnRate": "Orders whose final status is returned ÷ all orders.",
            "avgAttempts": "Attempt rows ÷ orders.",
        },
    }

    # ------------------------------------------------ success table (train period only)
    train = out["train"]
    prior = float(train.ok.mean())
    table = {}
    for (t, w, wk, pay), sub in train.groupby(["location_type", "attempt_time", "weekend", "payment_type"]):
        s, n = float(sub.ok.sum()), float(len(sub))
        table[f"{t}|{w}|{'weekend' if wk else 'weekday'}|{pay}"] = {
            "p": r4((s + TABLE_PRIOR * prior) / (n + TABLE_PRIOR)), "n": int(n)}
    success_table = {"prior": r4(prior), "priorStrength": TABLE_PRIOR, "trainedOn": "attempts 2026-09-01 to 2026-09-30",
                     "cells": table}

    # ------------------------------------------------ model file
    model = {
        "kind": "logistic_regression",
        "target": "Attempt delivered on that day (1) vs failed or returned (0)",
        "trainedOn": "attempts 2026-09-01 to 2026-09-30", "nTrain": out["n_train"],
        "holdout": "attempts 2026-10-01 to 2026-10-15", "nHoldout": out["n_test"],
        "features": feature_names(), "coef": {k: r4(v) for k, v in out["coef"].items()},
        "intercept": r4(out["intercept"]), "serviceMean": r4(out["service_mean"]),
        "serviceSd": r4(out["service_sd"]), "typeRate": {k: r4(v) for k, v in out["type_rate"].items()},
        "typeWindowRate": {k: r4(v) for k, v in out["tw_rate"].items()}, "priorStrength": 5.0,
    }

    def m3(d):
        return {k: r4(v) for k, v in d.items()}

    evaluation = {
        "split": {"train": "2026-09-01 to 2026-09-30", "holdout": "2026-10-01 to 2026-10-15",
                  "nTrain": out["n_train"], "nHoldout": out["n_test"],
                  "trainSuccess": r4(out["train_success"]), "holdoutSuccess": r4(out["test_success"])},
        "scores": {"baseRate": m3(out["metrics"]["base_rate"]), "historyTable": m3(out["metrics"]["history_table"]),
                   "model": m3(out["metrics"]["model"])},
        "calibration": [{k: r4(v) if isinstance(v, float) else v for k, v in c.items()} for c in out["calibration"]],
        "byType": [{k: (r4(v) if isinstance(v, float) else v) for k, v in b.items()} for b in out["by_type"]],
        "windowCheck": {k: {kk: (r4(vv) if isinstance(vv, float) else vv) for kk, vv in v.items()}
                        for k, v in out["window_check"].items()},
        "gradientBoosting": m3(out["metrics"]["gradient_boosting"]),
    }

    # ------------------------------------------------ knowledge + fixtures (every rider zone)
    used_names = set()

    def buyer_name():
        while True:
            n = f"{rng.choice(FAMILY)} {rng.choice(MIDDLE)} {rng.choice(GIVEN)}"
            if n not in used_names:
                used_names.add(n)
                return n

    name_rng = random.Random(7)
    used_loc_names = set(n for v in LOCATION_NAMES.values() for n in v)

    def fictional_location(t):
        while True:
            n = f"{name_rng.choice(PLACE_WORDS)} {name_rng.choice(PLACE_SUFFIX[t])}"
            if n not in used_loc_names:
                used_loc_names.add(n)
                return n

    knowledge, shifts, riders = [], [], []
    for zi, (rid, letter, rname) in enumerate(RIDERS):
        zone = df[df.rider_id == rid]
        pins = zone.dropna(subset=["address_latitude"])
        proj = make_projector(float(pins.address_latitude.mean()), float(pins.address_longitude.mean()))
        loc_ids = sorted(zone.location_id.unique())
        loc_key, loc_name = {}, {}
        if rid == DEMO_RIDER:  # keep the original demo zone exactly as before
            name_pool = {k: list(v) for k, v in LOCATION_NAMES.items()}
            for i, lid in enumerate(loc_ids):
                t = zone[zone.location_id == lid].location_type.iloc[0]
                loc_key[lid] = f"loc-{i + 1:02d}"
                loc_name[lid] = name_pool[t].pop(0)
        else:
            for i, lid in enumerate(loc_ids):
                t = zone[zone.location_id == lid].location_type.iloc[0]
                loc_key[lid] = f"z{letter.lower()}-{i + 1:02d}"
                loc_name[lid] = fictional_location(t)

        hist = zone[zone.delivery_date < KNOWLEDGE_CUTOFF]
        zone_keys = []
        for lid in loc_ids:
            sub = hist[hist.location_id == lid]
            t = zone[zone.location_id == lid].location_type.iloc[0]
            notes = Counter()
            for raw in sub.access_context_raw:
                for text, kind in split_notes(raw):
                    notes[(text, kind)] += 1
            visits = len(sub)

            def top(kind, min_share=0.15):
                if not visits:
                    return []
                items = [(txt, n) for (txt, k), n in notes.items() if k == kind and n >= 2 and n / visits >= min_share]
                return [{"text": txt, "count": int(n)} for txt, n in sorted(items, key=lambda x: -x[1])]

            delivered_pins = [proj(a, b) for a, b in zip(sub[sub.ok == 1].address_latitude, sub[sub.ok == 1].address_longitude)]
            delivered_pins = [p for p in delivered_pins if p]
            all_pins = [p for p in (proj(a, b) for a, b in zip(sub.address_latitude, sub.address_longitude)) if p]
            cand = [round(float(np.mean([p[0] for p in delivered_pins])), 1),
                    round(float(np.mean([p[1] for p in delivered_pins])), 1)] if delivered_pins else None
            spread = round(float(np.mean([math.dist(p, cand) for p in all_pins])), 0) if cand and all_pins else None
            windows = {}
            for w in WINDOWS:
                for daytype, mask in (("weekday", ~sub.weekend), ("weekend", sub.weekend)):
                    ss = sub[(sub.attempt_time == w) & mask]
                    windows[f"{w}|{daytype}"] = {"attempts": int(len(ss)), "delivered": int(ss.ok.sum())}
            restrictions = []
            weekend_visits = int(sub.weekend.sum())
            window_items = top("window")
            # weekend closures only show up on weekend visits, so judge them against weekend visits
            for (txt, k), n in notes.items():
                if (k == "window" and "weekend" in txt and n >= 2 and weekend_visits
                        and n / weekend_visits >= 0.15 and txt not in [w["text"] for w in window_items]):
                    window_items.append({"text": txt, "count": int(n)})
            for item in window_items:
                rule = WINDOW_RULES.get(item["text"])
                if rule:
                    restrictions.append({**item, **rule})
            svc = sub.buyer_address_processing_time_min.dropna()
            knowledge.append({
                "key": loc_key[lid], "zone": letter, "name": loc_name[lid], "type": t,
                "visits": int(visits), "firstAttemptSuccess": r4(sub.ok.mean()) if visits else None,
                "entranceCandidate": cand, "pinSpreadMeters": spread,
                "pinMissingShare": r4(sub.address_latitude.isna().mean()) if visits else None,
                "serviceMinutesMedian": None if svc.empty else float(svc.median()),
                "entranceNotes": top("entrance"), "handoverNotes": top("handover"),
                "accessNotes": top("restriction"), "windowNotes": window_items, "windowRestrictions": restrictions,
                "pastIssues": [{"text": txt, "count": int(n)} for (txt, k), n in notes.most_common() if k == "issue"][:5],
                "windowHistory": windows,
                "evidence": f"{visits} dataset visits, 1–30 Sep 2026" if visits else "No dataset visits before October 2026",
            })
            zone_keys.append(loc_key[lid])

        shift_ids = []
        for date, kind in SHIFT_DATES:
            sid = ("shift-wed" if kind == "weekday" else "shift-sat") if rid == DEMO_RIDER else f"shift-{letter.lower()}-{kind}"
            prefix = ("WED" if kind == "weekday" else "SAT") if rid == DEMO_RIDER else f"{letter}{'W' if kind == 'weekday' else 'S'}"
            day = zone[zone.delivery_date == pd.Timestamp(date)].sort_values("order_id")
            stops = []
            for i, r in enumerate(day.itertuples()):
                svc = None if pd.isna(r.buyer_address_processing_time_min) else float(r.buyer_address_processing_time_min)
                stops.append({
                    "id": f"{prefix}-{i + 1:02d}", "receivedOrder": i + 1, "buyer": buyer_name(),
                    "locationKey": loc_key[r.location_id], "locationType": r.location_type,
                    "payment": r.payment_type, "parcel": r.parcel_type,
                    "pin": proj(r.address_latitude, r.address_longitude),
                    "serviceMinutes": svc, "isReattempt": bool(r.attempt_no > 1),
                })
            dt = pd.Timestamp(date)
            actual = {"attempts": int(len(day)), "delivered": int(day.ok.sum()),
                      "byWindow": {w: {"attempts": int((day.attempt_time == w).sum()),
                                       "delivered": int(day[day.attempt_time == w].ok.sum())} for w in WINDOWS}}
            shifts.append({"id": sid, "riderId": f"rider-{letter.lower()}", "date": date, "weekday": dt.day_name(),
                           "isWeekend": bool(dt.dayofweek >= 5),
                           "zoneLabel": f"Zone {letter} (one dataset rider area, de-identified)", "stops": stops,
                           "actualDatasetOutcome": actual})
            shift_ids.append(sid)

        zk = [k for k in knowledge if k["zone"] == letter]
        all_pts = [k["entranceCandidate"] for k in zk if k["entranceCandidate"]]
        cx = float(np.mean([p[0] for p in all_pts]))
        cy = float(np.mean([p[1] for p in all_pts]))
        hub = [round(cx - 350, 1), round(cy - 250, 1)]
        if rid == DEMO_RIDER:
            pickups = [[-700, 560], [180, -720]]
        else:
            pickups = [[round(cx + 320, 0), round(cy + 280, 0)], [round(cx - 260, 0), round(cy - 380, 0)]]
        shop_names = PICKUP_NAMES[zi]
        riders.append({
            "id": f"rider-{letter.lower()}", "letter": letter, "name": rname,
            "label": f"Rider {letter} · {rname}", "persona": "new-rider persona (tenure is not in the dataset)",
            "zoneLabel": f"Zone {letter}", "hub": {"name": f"Hub {letter}", "pos": hub},
            "pickupPoints": [{"id": f"pp-{letter.lower()}-{j + 1}", "name": f"{shop_names[j]} (demo pickup point)",
                              "pos": pickups[j], "hours": ["07:00–21:00", "08:00–20:00"][j]} for j in range(2)],
            "shiftIds": shift_ids, "locations": len(zone_keys),
        })

    for k in knowledge:
        k["zone"] = f"rider-{k['zone'].lower()}"
    fixtures = {"riders": riders, "knowledge": knowledge, "shifts": shifts,
                "note": "De-identified demo fixtures generated from the Strategy dataset. Names are fictional; positions are rotated local metres per zone."}

    OUT.mkdir(parents=True, exist_ok=True)
    for name, obj in [("historical-stats.json", historical), ("success-table.json", success_table),
                      ("model.json", model), ("evaluation.json", evaluation), ("demo-fixtures.json", fixtures)]:
        (OUT / name).write_text(json.dumps(obj, ensure_ascii=False, indent=None if name == "demo-fixtures.json" else 1, separators=(",", ":") if name == "demo-fixtures.json" else None))
        print("wrote", name)

    # parity cases for the TypeScript model test (computed with sklearn)
    test = out["test"].head(40)
    X = te.matrix(test, out["service_mean"], out["service_sd"])
    probs = out["model"].predict_proba(X)[:, 1]
    cases = []
    for row, p in zip(X, probs):
        cases.append({"x": [r4(v) for v in row], "p": r4(p)})
    (ROOT / "src" / "lib" / "__tests__").mkdir(parents=True, exist_ok=True)
    (ROOT / "src" / "lib" / "__tests__" / "model-parity.json").write_text(json.dumps(cases))
    print("wrote model-parity.json")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "data-private/strategy_dataset.xlsx")
