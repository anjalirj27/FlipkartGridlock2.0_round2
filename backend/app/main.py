"""
main.py
FastAPI backend for the Gridlock Parking-Congestion Intelligence Platform.
Loads the pre-built cache on startup (run build_cache.py first) and serves
all hotspot, forecast, patrol, economic, and analytics data via REST.
"""
import math
import pickle
from contextlib import asynccontextmanager

import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from app.patrol_optimizer import allocate_patrol, budget_sensitivity
from app.live_prediction import predict_hour_risk, hourly_profile
from app.congestion_simulator import congestion_impact, congestion_curve
from app.commissioner_dashboard import build_dashboard, generate_enforcement_plan
from app.alerts import build_alerts
from app.copilot import answer_question
from app.scenarios import run_scenario, SCENARIOS

CACHE_PATH = "data/cache.pkl"
STATE: dict = {}


def clean_json(obj):
    """Recursively replace NaN/Inf (which break standard JSON) with None."""
    if isinstance(obj, dict):
        return {k: clean_json(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [clean_json(v) for v in obj]
    if isinstance(obj, float) and (math.isnan(obj) or math.isinf(obj)):
        return None
    if isinstance(obj, (np.floating,)):
        v = float(obj)
        return None if (math.isnan(v) or math.isinf(v)) else v
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, (np.bool_,)):
        return bool(obj)
    return obj


def df_to_records(df: pd.DataFrame) -> list:
    return clean_json(df.replace({np.nan: None}).to_dict(orient="records"))


@asynccontextmanager
async def lifespan(app: FastAPI):
    with open(CACHE_PATH, "rb") as f:
        cache = pickle.load(f)
    STATE.update(cache)
    print(f"Loaded cache: {len(STATE['hotspots'])} hotspots")
    yield


app = FastAPI(title="Gridlock Congestion Intelligence API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    return {"status": "ok", "hotspots_loaded": len(STATE.get("hotspots", []))}


@app.get("/api/summary")
def get_summary():
    return clean_json(STATE["summary"])


@app.get("/api/hotspots")
def get_hotspots(hotspot_type: str | None = None, min_risk: float | None = None):
    df = STATE["hotspots"].copy()
    if hotspot_type:
        df = df[df["hotspot_type"] == hotspot_type]
    if min_risk is not None:
        df = df[df["risk_score"] >= min_risk]
    cols = [
        "hotspot_id", "latitude", "longitude", "violations", "unique_vehicles",
        "risk_score", "PCII", "hotspot_type", "recommendation", "impact_score",
        "trust_score", "nearest_station", "distance_to_station_km",
        "forecasted_next_week_violations", "forecasted_next_week_violations_event_adjusted",
        "trend", "trend_pct", "top_risk_driver", "annualized_economic_loss_rs",
        "evolution_pct_change", "evolution_reliable", "avg_repeat_count",
        "vehicles_seen_5plus_times", "dominant_vehicle", "dominant_police_station",
        "capacity_loss_pct", "dist_to_nearest_metro_km", "near_metro", "patrol_allocated",
    ]
    return df_to_records(df[cols])


@app.get("/api/hotspots/{hotspot_id}")
def get_hotspot_detail(hotspot_id: str):
    df = STATE["hotspots"]
    row = df[df["hotspot_id"] == hotspot_id]
    if row.empty:
        raise HTTPException(status_code=404, detail="Hotspot not found")
    return clean_json(row.iloc[0].replace({np.nan: None}).to_dict())


@app.get("/api/map-data")
def get_map_data():
    df = STATE["hotspots"]
    cols = ["hotspot_id", "latitude", "longitude", "risk_score", "PCII", "hotspot_type",
            "violations", "recommendation", "nearest_station", "distance_to_station_km",
            "capacity_loss_pct", "near_metro"]
    return df_to_records(df[cols])


@app.get("/api/forecast")
def get_forecast():
    df = STATE["hotspots"]
    cols = ["hotspot_id", "violations", "forecasted_next_week_violations",
            "forecasted_next_week_violations_event_adjusted", "trend", "trend_pct"]
    return df_to_records(df[cols])


@app.get("/api/feature-importance")
def get_feature_importance():
    return STATE["summary"]["feature_importance"]


@app.get("/api/patrol-allocation")
def get_patrol_allocation(budget: int = Query(50, ge=1, le=500)):
    allocated = allocate_patrol(STATE["hotspots"], budget)
    total_risk_all = allocated["risk_score"].sum()
    covered = allocated.loc[allocated["patrol_allocated"], "risk_score"].sum()
    cols = ["hotspot_id", "hotspot_type", "risk_score", "units_required",
            "nearest_station", "distance_to_station_km", "patrol_allocated"]
    return {
        "budget": budget,
        "units_used": int(allocated.loc[allocated["patrol_allocated"], "units_required"].sum()),
        "total_units_needed_for_full_coverage": int(allocated["units_required"].sum()),
        "hotspots_covered": int(allocated["patrol_allocated"].sum()),
        "coverage_pct": round(float(covered / total_risk_all * 100), 2),
        "allocation": df_to_records(allocated.sort_values("risk_score", ascending=False)[cols]),
    }


@app.get("/api/budget-sensitivity")
def get_budget_sensitivity():
    allocated = allocate_patrol(STATE["hotspots"], 50)
    budgets = [10, 20, 30, 50, 70, 100, 150, 200, int(allocated["units_required"].sum())]
    return budget_sensitivity(allocated, budgets)


@app.get("/api/what-if/hours")
def what_if_hours(extra_hours: int = Query(4, ge=1, le=9), capture_pct: int = Query(70, ge=10, le=100)):
    s = STATE["summary"]
    capture = capture_pct / 100
    coverage_end_hour = max(s["enforcement_hours_valid"])
    extension_start_hour = coverage_end_hour + 1
    extension_end_hour = min(23, extension_start_hour + extra_hours - 1)
    additional_daily = extra_hours * s["peak_hour_daily_avg"] * capture
    additional_annual = additional_daily * 365
    additional_loss = additional_annual * s["avg_economic_loss_per_violation_rs"]
    return {
        "extra_hours": extra_hours,
        "capture_pct": capture_pct,
        "extension_start_hour": extension_start_hour,
        "extension_end_hour": extension_end_hour,
        "projected_additional_violations_per_day": round(additional_daily, 1),
        "projected_additional_violations_per_year": round(additional_annual),
        "projected_additional_recoverable_loss_rs": round(additional_loss),
        "note": f"Projection only - reliable enforcement data covers 0:00-{coverage_end_hour}:00; "
                f"hours from {extension_start_hour}:00 onward have no recorded data.",
    }


@app.get("/api/economic-loss")
def get_economic_loss():
    df = STATE["hotspots"].sort_values("annualized_economic_loss_rs", ascending=False)
    cols = ["hotspot_id", "hotspot_type", "annualized_economic_loss_rs"]
    return {
        "total_annualized_rs": STATE["summary"]["annualized_economic_loss_rs"],
        "top10_loss_share_pct": STATE["summary"]["top10_loss_share_pct"],
        "by_hotspot": df_to_records(df[cols]),
    }


@app.get("/api/repeat-offenders")
def get_repeat_offenders(limit: int = Query(50, ge=1, le=500)):
    df = STATE["repeat_offenders"].head(limit)
    behavior_counts = STATE["repeat_offenders"]["behavior_pattern"].value_counts().to_dict()
    return {
        "total_repeat_offenders": int(len(STATE["repeat_offenders"])),
        "behavior_pattern_counts": behavior_counts,
        "top_offenders": df_to_records(df),
    }


@app.get("/api/multi-location-offenders")
def get_multi_location_offenders(limit: int = Query(20, ge=1, le=200)):
    df = STATE["multi_location"].head(limit)
    return df_to_records(df)


@app.get("/api/evolution")
def get_evolution():
    evo = STATE["evolution"]
    reliable = evo[evo["reliable"]]
    emerging = reliable.sort_values("pct_change", ascending=False).head(10)
    declining = reliable.sort_values("pct_change").head(10)
    return {
        "city_trend": STATE["city_trend"],
        "reliable_count": int(reliable.shape[0]),
        "total_count": int(evo.shape[0]),
        "top_emerging": df_to_records(emerging),
        "top_declining": df_to_records(declining),
    }


@app.get("/api/citizen-trust")
def get_citizen_trust():
    df = STATE["hotspots"]
    return {
        "average_trust_score": float(df["trust_score"].mean()),
        "distribution": df_to_records(df[["hotspot_id", "trust_score", "rejected", "duplicate"]]),
    }


# ============================================================
# PHASE 2 ENDPOINTS
# ============================================================

@app.get("/api/road-capacity")
def get_road_capacity(limit: int = Query(15, ge=1, le=246)):
    df = STATE["hotspots"].sort_values("capacity_loss_pct", ascending=False).head(limit)
    cols = ["hotspot_id", "hotspot_type", "violations", "capacity_loss_pct",
            "capacity_loss_pct_10min", "capacity_loss_pct_15min", "capacity_loss_pct_20min",
            "avg_vehicle_width_m", "PCII"]
    return {
        "road_width_m": 7.0,
        "methodology": "Little's Law (L=\u03bbW) concurrent-vehicle estimate, IRC road-width "
                        "standard, sensitivity-tested across 10/15/20-min dwell-time assumptions.",
        "top_hotspots": df_to_records(df[cols]),
    }


@app.get("/api/before-after")
def get_before_after():
    return clean_json(STATE["summary"]["before_after_enforcement"])


@app.get("/api/roi")
def get_roi():
    return clean_json(STATE["summary"]["roi"])


@app.get("/api/location-intelligence")
def get_location_intelligence():
    return clean_json(STATE["summary"]["location_intelligence"])


@app.get("/api/live-prediction")
def get_live_prediction(
    hotspot_id: str,
    hour: int = Query(..., ge=0, le=23),
    is_weekend: bool = False,
    is_event_day: bool = False,
):
    result = predict_hour_risk(STATE["hourly_baseline"], STATE["valid_hours"], hotspot_id, hour, is_weekend, is_event_day)
    return clean_json(result)


@app.get("/api/live-prediction/profile")
def get_live_prediction_profile(hotspot_id: str):
    profile = hourly_profile(STATE["hourly_baseline"], STATE["valid_hours"], hotspot_id)
    return {
        "hotspot_id": hotspot_id,
        "valid_hours": STATE["valid_hours"],
        "profile": clean_json(profile),
    }


@app.get("/api/congestion-simulator")
def get_congestion_simulator(hotspot_id: str, vc_ratio: float = Query(0.7, ge=0.1, le=1.0)):
    row = STATE["hotspots"][STATE["hotspots"]["hotspot_id"] == hotspot_id]
    if row.empty:
        raise HTTPException(status_code=404, detail="Hotspot not found")
    capacity_loss = float(row.iloc[0]["capacity_loss_pct"])
    result = congestion_impact(capacity_loss, vc_ratio)
    curve = congestion_curve(capacity_loss)
    return {
        "hotspot_id": hotspot_id,
        "vc_ratio_background": vc_ratio,
        "result": clean_json(result),
        "curve": clean_json(curve),
    }


# ============================================================
# PHASE 3 ENDPOINTS - Commissioner Dashboard, Alerts, Copilot, Scenarios
# ============================================================

@app.get("/api/commissioner-dashboard")
def get_commissioner_dashboard():
    dashboard = build_dashboard(STATE["hotspots"], STATE["evolution"], STATE["summary"]["roi"], STATE["summary"])
    return clean_json(dashboard)


@app.get("/api/enforcement-plan")
def get_enforcement_plan(top_n: int = Query(10, ge=1, le=50)):
    plan = generate_enforcement_plan(STATE["hotspots"], top_n)
    return clean_json(plan)


@app.get("/api/alerts")
def get_alerts(priority: str | None = None):
    alerts = build_alerts(STATE["hotspots"])
    if priority:
        alerts = [a for a in alerts if a["priority"].lower() == priority.lower()]
    counts = {"Critical": 0, "High": 0, "Medium": 0}
    for a in build_alerts(STATE["hotspots"]):
        counts[a["priority"]] += 1
    return {"counts": counts, "alerts": clean_json(alerts)}


@app.get("/api/copilot")
def get_copilot_answer(question: str, hotspot_id: str | None = None):
    result = answer_question(question, hotspot_id, STATE["hotspots"], STATE["evolution"], STATE["summary"]["roi"], STATE["summary"])
    return clean_json(result)


@app.get("/api/scenarios")
def list_scenarios():
    return SCENARIOS


@app.get("/api/scenarios/{name}")
def get_scenario(name: str):
    try:
        result = run_scenario(name, STATE["hotspots"])
    except ValueError:
        raise HTTPException(status_code=404, detail=f"Unknown scenario '{name}'. Available: {list(SCENARIOS.keys())}")
    return clean_json(result)
