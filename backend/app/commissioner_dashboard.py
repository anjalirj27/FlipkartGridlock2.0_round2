"""
commissioner_dashboard.py
Bundles the key executive-level stats (highest risk hotspot, next-week risk
leader, patrol units needed, annual savings potential, top emerging zone)
into one response, and generates a prioritized "Enforcement Plan" - all
derived from already-validated data, nothing new computed here.
"""
import pandas as pd


def build_dashboard(hotspots: pd.DataFrame, evolution: pd.DataFrame, roi: dict, summary: dict) -> dict:
    highest_risk = hotspots.sort_values("risk_score", ascending=False).iloc[0]

    rising = hotspots[hotspots["trend"] == "Rising"].sort_values("forecasted_next_week_violations", ascending=False)
    next_week_leader = rising.iloc[0] if len(rising) else hotspots.sort_values("forecasted_next_week_violations", ascending=False).iloc[0]

    reliable_evo = evolution[evolution["reliable"]]
    top_emerging = reliable_evo.sort_values("pct_change", ascending=False).iloc[0] if len(reliable_evo) else None

    return {
        "highest_risk_hotspot": {
            "hotspot_id": highest_risk["hotspot_id"],
            "risk_score": round(float(highest_risk["risk_score"]), 3),
            "PCII": float(highest_risk["PCII"]),
            "hotspot_type": highest_risk["hotspot_type"],
            "capacity_loss_pct": round(float(highest_risk["capacity_loss_pct"]), 1),
        },
        "expected_next_week_risk": {
            "hotspot_id": next_week_leader["hotspot_id"],
            "forecasted_violations": int(next_week_leader["forecasted_next_week_violations"]),
            "trend_pct": round(float(next_week_leader["trend_pct"]), 1),
        },
        "patrol_units_needed": {
            "recommended_budget": roi["units_used"],
            "full_coverage_needed": int(hotspots["units_required"].sum()),
            "hotspots_covered_at_recommended": int(hotspots["patrol_allocated"].sum()),
        },
        "annual_savings_potential_rs": roi["annual_savings_rs"],
        "top_emerging_zone": {
            "hotspot_id": top_emerging["hotspot_id"] if top_emerging is not None else None,
            "pct_change": round(float(top_emerging["pct_change"]), 1) if top_emerging is not None else None,
        },
        "total_hotspots": summary["total_hotspots"],
        "avg_trust_score": round(float(hotspots["trust_score"].mean()), 2),
    }


def generate_enforcement_plan(hotspots: pd.DataFrame, top_n: int = 10) -> list[dict]:
    """A prioritized, ready-to-brief action list - reuses validated fields only."""
    allocated = hotspots[hotspots["patrol_allocated"]].sort_values("risk_score", ascending=False).head(top_n)
    plan = []
    for rank, (_, row) in enumerate(allocated.iterrows(), start=1):
        plan.append({
            "priority_rank": rank,
            "hotspot_id": row["hotspot_id"],
            "hotspot_type": row["hotspot_type"],
            "PCII": float(row["PCII"]),
            "capacity_loss_pct": round(float(row["capacity_loss_pct"]), 1),
            "units_assigned": int(row["units_required"]),
            "nearest_station": row["nearest_station"],
            "action": row["recommendation"],
            "trend": row["trend"],
        })
    return plan
