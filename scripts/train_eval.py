"""Train and evaluate the S-Compass first-attempt success model.

Usage (from the project root):
    python3 scripts/train_eval.py data-private/strategy_dataset.xlsx

Outputs a dict used by build_data.py. Nothing raw is written here.
Split: train = attempts before 2026-10-01, holdout = attempts from 2026-10-01.
"""
import sys
from collections import defaultdict

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import brier_score_loss, log_loss, roc_auc_score

sys.path.insert(0, __file__.rsplit("/", 1)[0])
from features import (LOC_TYPES, WINDOWS, build_row, feature_names,  # noqa: E402
                      smoothed_logit_gap)

SPLIT = pd.Timestamp("2026-10-01")
C_REG = 1.0


def load(path):
    df = pd.read_excel(path, sheet_name="Data")
    df = df.sort_values(["delivery_date", "order_id"]).reset_index(drop=True)
    df["ok"] = (df.delivery_status == "delivered").astype(int)
    df["attempt_no"] = df.groupby("order_id").cumcount() + 1
    df["weekend"] = df.delivery_date.dt.dayofweek >= 5
    return df


def priors(train):
    type_rate = train.groupby("location_type").ok.mean().to_dict()
    tw_rate = train.groupby(["location_type", "attempt_time"]).ok.mean().to_dict()
    return type_rate, tw_rate


def add_history(df, type_rate, tw_rate):
    """Location history features computed only from EARLIER dates."""
    loc_s, loc_n = defaultdict(float), defaultdict(float)
    lw_s, lw_n = defaultdict(float), defaultdict(float)
    lh, lwh = np.zeros(len(df)), np.zeros(len(df))
    for date, idx in df.groupby("delivery_date").groups.items():
        sub = df.loc[idx]
        for i, r in sub.iterrows():
            lid, w, t = r.location_id, r.attempt_time, r.location_type
            lh[i] = smoothed_logit_gap(loc_s[lid], loc_n[lid], type_rate[t])
            lwh[i] = smoothed_logit_gap(lw_s[(lid, w)], lw_n[(lid, w)], tw_rate[(t, w)])
        for _, r in sub.iterrows():
            loc_s[r.location_id] += r.ok
            loc_n[r.location_id] += 1
            lw_s[(r.location_id, r.attempt_time)] += r.ok
            lw_n[(r.location_id, r.attempt_time)] += 1
    df = df.copy()
    df["loc_hist"], df["loc_win_hist"] = lh, lwh
    return df


def matrix(df, s_mean, s_sd):
    rows = []
    for r in df.itertuples():
        svc = None if pd.isna(r.buyer_address_processing_time_min) else float(r.buyer_address_processing_time_min)
        rows.append(build_row(
            loc_type=r.location_type, window=r.attempt_time, weekend=bool(r.weekend),
            payment=r.payment_type, parcel=r.parcel_type,
            has_pin=not pd.isna(r.address_latitude), service_min=svc,
            attempt_no=int(r.attempt_no), loc_hist=r.loc_hist, loc_win_hist=r.loc_win_hist,
            service_mean=s_mean, service_sd=s_sd))
    return np.array(rows)


def run(path):
    df = load(path)
    train, test = df[df.delivery_date < SPLIT], df[df.delivery_date >= SPLIT]
    type_rate, tw_rate = priors(train)
    df = add_history(df, type_rate, tw_rate)
    train, test = df[df.delivery_date < SPLIT], df[df.delivery_date >= SPLIT]
    s = train.buyer_address_processing_time_min.dropna()
    s_mean, s_sd = float(s.mean()), float(s.std())
    Xtr, Xte = matrix(train, s_mean, s_sd), matrix(test, s_mean, s_sd)
    ytr, yte = train.ok.values, test.ok.values

    model = LogisticRegression(C=C_REG, max_iter=2000)
    model.fit(Xtr, ytr)
    p_model = model.predict_proba(Xte)[:, 1]

    base = np.full(len(test), ytr.mean())
    # History table = the lookup used by the rules planner (src/lib/successTable.ts):
    # location type x window x weekday/weekend x payment, shrunk toward the overall rate.
    cell = train.groupby(["location_type", "attempt_time", "weekend", "payment_type"]).ok.agg(["sum", "count"])
    prior = ytr.mean()

    def cell_p(r):
        key = (r.location_type, r.attempt_time, r.weekend, r.payment_type)
        if key in cell.index:
            s_, n_ = cell.loc[key]
            return (s_ + 5.0 * prior) / (n_ + 5.0)
        return prior

    p_cell = np.array([cell_p(r) for r in test.itertuples()])

    def scores(p):
        return {"auc": float(roc_auc_score(yte, p)), "brier": float(brier_score_loss(yte, p)),
                "log_loss": float(log_loss(yte, p))}

    # Extra check: a gradient-boosting model on the same features (not adopted)
    from sklearn.ensemble import HistGradientBoostingClassifier
    gbm = HistGradientBoostingClassifier(learning_rate=0.03, max_iter=300, max_leaf_nodes=15,
                                         l2_regularization=1.0, random_state=0).fit(Xtr, ytr)
    p_gbm = gbm.predict_proba(Xte)[:, 1]

    metrics = {"base_rate": scores(base), "history_table": scores(p_cell), "model": scores(p_model),
               "gradient_boosting": scores(p_gbm)}

    # Calibration on holdout (deciles of predicted probability)
    bins = pd.qcut(p_model, 5, labels=False, duplicates="drop")
    calib = [{"mean_predicted": float(p_model[bins == b].mean()), "observed": float(yte[bins == b].mean()),
              "n": int((bins == b).sum())} for b in sorted(set(bins))]

    # Where the model is weak: holdout error by location type
    by_type = []
    for t in LOC_TYPES:
        m = (test.location_type == t).values
        by_type.append({"location_type": t, "n": int(m.sum()), "observed": float(yte[m].mean()),
                        "mean_predicted": float(p_model[m].mean()),
                        "auc": float(roc_auc_score(yte[m], p_model[m])) if len(set(yte[m])) > 1 else None})

    # Observational window check (NOT causal): success when the actual window matched the recommendation
    def best_window(r):
        best, bp = None, -1
        for w in WINDOWS:
            row = build_row(loc_type=r.location_type, window=w, weekend=bool(r.weekend), payment=r.payment_type,
                            parcel=r.parcel_type, has_pin=not pd.isna(r.address_latitude),
                            service_min=None if pd.isna(r.buyer_address_processing_time_min) else float(r.buyer_address_processing_time_min),
                            attempt_no=int(r.attempt_no), loc_hist=r.loc_hist,
                            loc_win_hist=r.loc_win_hist if w == r.attempt_time else 0.0,
                            service_mean=s_mean, service_sd=s_sd)
            p = model.predict_proba(np.array([row]))[0, 1]
            if p > bp:
                best, bp = w, p
        return best

    test = test.copy()
    test["model_win"] = [best_window(r) for r in test.itertuples()]
    def table_best(r):
        best, bp = None, -1
        for w in WINDOWS:
            key = (r.location_type, w, r.weekend, r.payment_type)
            s_, n_ = cell.loc[key] if key in cell.index else (0.0, 0.0)
            p = (s_ + 5.0 * prior) / (n_ + 5.0)
            if p > bp:
                best, bp = w, p
        return best

    test["rules_win"] = [table_best(r) for r in test.itertuples()]
    obs = {}
    for k in ["model_win", "rules_win"]:
        m = test.attempt_time == test[k]
        obs[k] = {"match_n": int(m.sum()), "match_success": float(test.ok[m].mean()),
                  "other_n": int((~m).sum()), "other_success": float(test.ok[~m].mean())}

    coef = dict(zip(feature_names(), map(float, model.coef_[0])))
    return {
        "model": model, "df": df, "train": train, "test": test, "metrics": metrics, "calibration": calib,
        "by_type": by_type, "window_check": obs, "coef": coef, "intercept": float(model.intercept_[0]),
        "service_mean": s_mean, "service_sd": s_sd, "type_rate": type_rate,
        "tw_rate": {f"{k[0]}|{k[1]}": v for k, v in tw_rate.items()},
        "n_train": int(len(train)), "n_test": int(len(test)),
        "train_success": float(ytr.mean()), "test_success": float(yte.mean()),
    }


if __name__ == "__main__":
    out = run(sys.argv[1])
    import json
    print(json.dumps({k: out[k] for k in ["metrics", "calibration", "by_type", "window_check", "coef", "intercept",
                                          "n_train", "n_test", "train_success", "test_success"]}, indent=1))
