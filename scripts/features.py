"""Shared feature definitions for the S-Compass success model.

The same feature list is re-implemented in TypeScript (src/lib/model.ts).
Only information that is known BEFORE an attempt is used. The raw
`access_context_raw` notes are NOT used as model features, because many
notes are written on arrival and describe what happened (for example
"receptionist has left"), which would leak the outcome.
"""
import math

LOC_TYPES = ["school", "office", "industrial", "gated_facility"]
WINDOWS = ["morning", "afternoon", "evening"]
PARCELS = ["standard", "bulky", "fragile", "documents"]
PRIOR_STRENGTH = 5.0  # pseudo-attempts used to smooth location history


def logit(p: float) -> float:
    p = min(max(p, 1e-4), 1 - 1e-4)
    return math.log(p / (1 - p))


def smoothed_logit_gap(successes: float, attempts: float, prior: float) -> float:
    """Shrunk log-odds difference between a location's history and its prior."""
    a = PRIOR_STRENGTH
    p = (successes + a * prior) / (attempts + a)
    return logit(p) - logit(prior)


def feature_names():
    names = []
    names += [f"type_{t}" for t in LOC_TYPES[1:]]
    names += [f"win_{w}" for w in WINDOWS[1:]]
    names += [f"type_{t}_x_win_{w}" for t in LOC_TYPES[1:] for w in WINDOWS[1:]]
    names += ["weekend"] + [f"weekend_x_type_{t}" for t in LOC_TYPES[1:]]
    names += ["weekend_x_win_evening"]
    names += ["cod", "cod_x_win_evening"]
    names += [f"parcel_{p}" for p in PARCELS[1:]]
    names += ["missing_pin", "service_min_z", "service_min_missing"]
    names += ["retry_attempt"]
    names += ["loc_history", "loc_window_history"]
    return names


def build_row(*, loc_type, window, weekend, payment, parcel, has_pin,
              service_min, attempt_no, loc_hist, loc_win_hist, service_mean, service_sd):
    x = {n: 0.0 for n in feature_names()}
    if loc_type != LOC_TYPES[0]:
        x[f"type_{loc_type}"] = 1.0
    if window != WINDOWS[0]:
        x[f"win_{window}"] = 1.0
    if loc_type != LOC_TYPES[0] and window != WINDOWS[0]:
        x[f"type_{loc_type}_x_win_{window}"] = 1.0
    if weekend:
        x["weekend"] = 1.0
        if loc_type != LOC_TYPES[0]:
            x[f"weekend_x_type_{loc_type}"] = 1.0
        if window == "evening":
            x["weekend_x_win_evening"] = 1.0
    if payment == "cod":
        x["cod"] = 1.0
        if window == "evening":
            x["cod_x_win_evening"] = 1.0
    if parcel != PARCELS[0]:
        x[f"parcel_{parcel}"] = 1.0
    x["missing_pin"] = 0.0 if has_pin else 1.0
    if service_min is None:
        x["service_min_missing"] = 1.0
    else:
        x["service_min_z"] = (service_min - service_mean) / service_sd
    x["retry_attempt"] = 1.0 if attempt_no > 1 else 0.0
    x["loc_history"] = loc_hist
    x["loc_window_history"] = loc_win_hist
    return [x[n] for n in feature_names()]
