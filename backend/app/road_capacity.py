"""
road_capacity.py
Phase-2 enhancement: converts violation counts into a physical road-capacity
loss estimate (answers "how do we know violations = congestion?"), a 0-100
PCII rescaling of risk_score, and before/after-enforcement + ROI comparisons.
Ported from the validated notebook cells - CORRECTED enforcement window
(0:00-14:00, 15 hours - not the earlier unverified "5AM-1PM" assumption).
"""
import pandas as pd

ROAD_WIDTH_M = 7.0  # IRC standard 2-lane urban carriageway width (no kerb)

VEHICLE_WIDTH_M = {
    "SCOOTER": 1.0, "MOTOR CYCLE": 1.0, "MOPED": 1.0,
    "CAR": 1.8, "PASSENGER AUTO": 1.6, "JEEP": 1.8, "VAN": 1.9,
    "MAXI-CAB": 2.0, "GOODS AUTO": 1.7, "LGV": 2.0, "TEMPO": 2.0,
    "BUS (BMTC/KSRTC)": 2.5, "PRIVATE BUS": 2.5, "TOURIST BUS": 2.5,
    "SCHOOL VEHICLE": 2.5, "FACTORY BUS": 2.5,
    "LORRY/GOODS VEHICLE": 2.5, "HGV": 2.5, "TANKER": 2.5,
    "TRACTOR": 2.0, "MINI LORRY": 2.2, "OTHERS": 1.6,
}
DEFAULT_VEHICLE_WIDTH_M = 1.6

ENFORCEMENT_HOURS_PER_DAY = 15  # 0:00-14:00, corrected from an earlier 5AM-1PM assumption
DWELL_MINUTES = [10, 15, 20]
HEADLINE_DWELL_MIN = 15


def compute_capacity_loss(df_valid: pd.DataFrame, hotspots: pd.DataFrame) -> pd.DataFrame:
    hotspots = hotspots.copy()
    df_valid = df_valid.copy()
    df_valid["vehicle_width_m"] = df_valid["vehicle_type"].map(VEHICLE_WIDTH_M).fillna(DEFAULT_VEHICLE_WIDTH_M)
    avg_width = df_valid.groupby("hotspot_id")["vehicle_width_m"].mean()
    hotspots["avg_vehicle_width_m"] = hotspots["hotspot_id"].map(avg_width)

    active_days = (df_valid["date"].max() - df_valid["date"].min()).days
    hotspots["violations_per_active_hour"] = (
        hotspots["violations"] / active_days / ENFORCEMENT_HOURS_PER_DAY
    )

    for dwell_min in DWELL_MINUTES:
        dwell_hours = dwell_min / 60
        concurrent = hotspots["violations_per_active_hour"] * dwell_hours
        occupied_width = concurrent * hotspots["avg_vehicle_width_m"]
        hotspots[f"capacity_loss_pct_{dwell_min}min"] = (
            (occupied_width / ROAD_WIDTH_M) * 100
        ).clip(upper=100)

    hotspots["capacity_loss_pct"] = hotspots[f"capacity_loss_pct_{HEADLINE_DWELL_MIN}min"]
    hotspots["PCII"] = (hotspots["risk_score"] * 100).round(1)
    return hotspots


def weighted_avg_capacity_loss(df_subset: pd.DataFrame) -> float:
    if df_subset["violations"].sum() == 0:
        return 0.0
    return float((df_subset["capacity_loss_pct"] * df_subset["violations"]).sum() / df_subset["violations"].sum())


def before_after_enforcement(hotspots: pd.DataFrame) -> dict:
    before_avg_capacity_loss = weighted_avg_capacity_loss(hotspots)
    before_avg_risk = float(hotspots["risk_score"].mean())
    before_critical_count = int((hotspots["capacity_loss_pct"] >= 50).sum())

    unpatrolled = hotspots[~hotspots["patrol_allocated"]]
    after_avg_capacity_loss = weighted_avg_capacity_loss(unpatrolled)
    after_avg_risk = float(unpatrolled["risk_score"].mean())
    after_critical_count = int((unpatrolled["capacity_loss_pct"] >= 50).sum())

    return {
        "before": {
            "avg_capacity_loss_pct": round(before_avg_capacity_loss, 1),
            "avg_risk_score": round(before_avg_risk, 3),
            "critical_hotspot_count": before_critical_count,
        },
        "after": {
            "avg_capacity_loss_pct": round(after_avg_capacity_loss, 1),
            "avg_risk_score": round(after_avg_risk, 3),
            "critical_hotspot_count": after_critical_count,
        },
    }


def roi_calculation(hotspots: pd.DataFrame) -> dict:
    before_total_loss = float(hotspots["annualized_economic_loss_rs"].sum())
    after_total_loss = float(
        hotspots.loc[~hotspots["patrol_allocated"], "annualized_economic_loss_rs"].sum()
    )
    savings = before_total_loss - after_total_loss
    units_used = int(hotspots.loc[hotspots["patrol_allocated"], "units_required"].sum())
    return {
        "before_total_loss_rs": round(before_total_loss),
        "after_total_loss_rs": round(after_total_loss),
        "annual_savings_rs": round(savings),
        "savings_per_unit_rs": round(savings / units_used) if units_used else 0,
        "units_used": units_used,
    }
