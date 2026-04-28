#!/usr/bin/env python3
"""
Train a lightweight multinomial logistic recommender model from in-repo data and
export coefficients to src/data/recommender_model.json for frontend inference.
"""
from __future__ import annotations

import json
from pathlib import Path
from dataclasses import dataclass
import numpy as np
from sklearn.linear_model import LogisticRegression


ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT / "src" / "data"
OUT = DATA_DIR / "recommender_model.json"


FEATURES = [
    "hazard_storm",
    "hazard_flood",
    "hazard_quake",
    "hazard_fire",
    "hazard_health",
    "city_prior",
    "fit_owner",
    "fit_renter",
    "fit_business",
    "age_norm",
    "income_norm",
    "property_norm",
    "vehicle_norm",
    "business_norm",
    "dependents_norm",
]

CALAMITY_TO_SIGNAL = {
    "Hurricane": "storm",
    "Flood": "flood",
    "Earthquake": "quake",
    "Wildfire": "fire",
    "Tsunami": "flood",
    "Blizzard": "storm",
    "Heatwave": "health",
}


@dataclass
class Sample:
    x: np.ndarray
    y: str


def load_json(name: str):
    return json.loads((DATA_DIR / name).read_text())


def phase_weight(date_str: str) -> float:
    # Assume data.json is relatively recent demo data; approximate activity weight from recency.
    # This keeps training deterministic and in-repo.
    return 1.0 if "2026" in date_str else 0.7


def make_city_signals(disasters):
    by_city = {}
    for d in disasters:
        city = d["Location"]["City"]
        sig = by_city.setdefault(city, {"storm": 0.0, "flood": 0.0, "quake": 0.0, "fire": 0.0, "health": 0.0})
        signal = CALAMITY_TO_SIGNAL.get(d["Disaster_Type"], "storm")
        sig[signal] += float(d["Magnitude"]) * phase_weight(str(d.get("Date", "")))
    return by_city


def build_dataset():
    holders = load_json("policy_holders.json")
    disasters = load_json("data.json")
    city_signals = make_city_signals(disasters)

    # city priors from observed portfolio
    city_type_prior = {}
    city_count = {}
    for h in holders:
        c = h["city"]
        t = h["policy_type"]
        city_count[c] = city_count.get(c, 0) + 1
        d = city_type_prior.setdefault(c, {})
        d[t] = d.get(t, 0) + 1
    for c, d in city_type_prior.items():
        total = max(1, city_count[c])
        for t in list(d.keys()):
            d[t] = d[t] / total

    rng = np.random.default_rng(42)
    samples: list[Sample] = []
    policy_types = sorted({h["policy_type"] for h in holders})

    # Simulate customer-like rows from existing holder distribution
    for h in holders[:4500]:
        city = h["city"]
        y = h["policy_type"]
        sig = city_signals.get(city, {"storm": 0, "flood": 0, "quake": 0, "fire": 0, "health": 0})
        annual_income = int(rng.integers(50000, 300000))
        age = int(rng.integers(22, 70))
        deps = int(rng.integers(0, 5))
        occ = rng.choice(["owner", "renter", "business"], p=[0.48, 0.33, 0.19])
        property_val = float(h["max_cover_amount"] * rng.uniform(0.7, 1.4))
        vehicle_val = float(rng.uniform(12000, 120000))
        business_val = float(rng.uniform(100000, 1200000))

        x = np.array([
            sig["storm"] / 8.0,
            sig["flood"] / 8.0,
            sig["quake"] / 8.0,
            sig["fire"] / 8.0,
            sig["health"] / 8.0,
            city_type_prior.get(city, {}).get(y, 0.03),
            1.0 if occ == "owner" else 0.0,
            1.0 if occ == "renter" else 0.0,
            1.0 if occ == "business" else 0.0,
            age / 100.0,
            min(annual_income / 500000.0, 2.0),
            min(property_val / 2000000.0, 2.0),
            min(vehicle_val / 300000.0, 2.0),
            min(business_val / 3000000.0, 2.0),
            min(deps / 6.0, 1.0),
        ])
        samples.append(Sample(x=x, y=y))

    X = np.vstack([s.x for s in samples])
    y = np.array([s.y for s in samples])

    clf = LogisticRegression(
        multi_class="multinomial",
        max_iter=900,
        C=1.0,
        random_state=42,
    )
    clf.fit(X, y)

    # Export in policy-type keyed format used by UI.
    classes = list(clf.classes_)
    intercepts = {classes[i]: float(clf.intercept_[i]) for i in range(len(classes))}
    weights = {classes[i]: [float(v) for v in clf.coef_[i].tolist()] for i in range(len(classes))}

    model = {
        "version": "1.0.0",
        "features": FEATURES,
        "intercepts": intercepts,
        "weights": weights,
    }
    OUT.write_text(json.dumps(model, indent=2))
    print(f"Saved model artifact to {OUT}")


if __name__ == "__main__":
    build_dataset()
