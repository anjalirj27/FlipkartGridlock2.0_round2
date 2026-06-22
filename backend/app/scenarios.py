"""
scenarios.py
Demo Scenario Mode - preconfigured, judge-facing views built ENTIRELY from
already-validated fields. "Commercial Area Overflow" has no ground-truth
zoning tag in this dataset, so it is explicitly labeled as an approximation
(high vehicle-diversity + weekday-dominant pattern), not presented as fact.
"""
import pandas as pd

from .data_pipeline import VALIDATED_EVENT_ADJUSTMENTS

SCENARIOS = {
    "metro_congestion": "Metro Station Congestion",
    "event_day": "Event-Day Congestion",
    "commercial_overflow": "Commercial Area Overflow Parking (approximated)",
}


def metro_congestion_scenario(hotspots: pd.DataFrame, top_n: int = 10) -> dict:
    near = hotspots[hotspots["near_metro"]].sort_values("risk_score", ascending=False).head(top_n)
    return {
        "scenario": SCENARIOS["metro_congestion"],
        "description": "Hotspots within 1km of a verified major Namma Metro station, ranked by risk.",
        "hotspots": near[["hotspot_id", "risk_score", "PCII", "capacity_loss_pct", "dist_to_nearest_metro_km", "violations"]].to_dict(orient="records"),
    }


def event_day_scenario(hotspots: pd.DataFrame, event_name: str = "New Year Eve", top_n: int = 10) -> dict:
    adjustment = VALIDATED_EVENT_ADJUSTMENTS.get(event_name, 0.0)
    top = hotspots.sort_values("risk_score", ascending=False).head(top_n).copy()
    top["projected_event_day_violations"] = (top["violations"] / 150 * (1 + adjustment)).round(1)  # daily rate, event-adjusted
    return {
        "scenario": SCENARIOS["event_day"],
        "description": f"Projected impact of '{event_name}' (validated same-weekday-baseline adjustment: "
                        f"+{adjustment*100:.1f}%) applied to the highest-risk hotspots.",
        "event_name": event_name,
        "validated_adjustment_pct": round(adjustment * 100, 1),
        "hotspots": top[["hotspot_id", "risk_score", "violations", "projected_event_day_violations"]].to_dict(orient="records"),
    }


def commercial_overflow_scenario(hotspots: pd.DataFrame, top_n: int = 10) -> dict:
    # APPROXIMATION - no commercial-zoning ground truth exists in this dataset.
    # Proxy: high vehicle diversity (many distinct vehicles -> mixed clientele,
    # typical of commercial strips) + weekday-dominant pattern (weekend_ratio < 0.4).
    candidates = hotspots[hotspots["weekend_ratio"] < 0.4].sort_values("vehicle_diversity", ascending=False).head(top_n)
    return {
        "scenario": SCENARIOS["commercial_overflow"],
        "description": "APPROXIMATION (not ground-truth zoning): hotspots with high vehicle diversity "
                        "and a weekday-dominant pattern - a reasonable proxy for commercial-area "
                        "overflow parking, but not a verified land-use tag.",
        "hotspots": candidates[["hotspot_id", "vehicle_diversity", "weekend_ratio", "violations", "risk_score"]].to_dict(orient="records"),
    }


def run_scenario(name: str, hotspots: pd.DataFrame) -> dict:
    if name == "metro_congestion":
        return metro_congestion_scenario(hotspots)
    if name == "event_day":
        return event_day_scenario(hotspots)
    if name == "commercial_overflow":
        return commercial_overflow_scenario(hotspots)
    raise ValueError(f"Unknown scenario: {name}")
