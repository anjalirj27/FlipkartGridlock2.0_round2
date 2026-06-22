"""
alerts.py
Urgent Congestion Notification System. Scans validated hotspot fields
(PCII, capacity_loss_pct, forecast trend) against documented thresholds and
generates Critical/High/Medium priority alerts with a recommended action -
no new data, just rule-based triage over what's already validated.
"""
import pandas as pd

# Documented thresholds (based on the actual distribution of validated hotspots -
# top hotspot PCII ~73, capacity_loss_pct up to ~52%)
THRESHOLDS = {
    "Critical": {"capacity_loss_pct": 40, "PCII": 65},
    "High": {"capacity_loss_pct": 25, "PCII": 50},
    "Medium": {"capacity_loss_pct": 15, "PCII": 35},
}


def _priority_for(row) -> str | None:
    for level in ["Critical", "High", "Medium"]:
        t = THRESHOLDS[level]
        if row["capacity_loss_pct"] >= t["capacity_loss_pct"] or row["PCII"] >= t["PCII"]:
            return level
    if row["trend"] == "Rising" and row["trend_pct"] >= 50:
        return "Medium"
    return None


def _recommended_action(row, priority: str) -> str:
    if priority == "Critical":
        return f"Immediate patrol deployment - {row['recommendation']}"
    if priority == "High":
        return f"Schedule enforcement within 24-48h - {row['recommendation']}"
    return f"Monitor and include in next patrol cycle - {row['recommendation']}"


def build_alerts(hotspots: pd.DataFrame) -> list[dict]:
    alerts = []
    for _, row in hotspots.iterrows():
        priority = _priority_for(row)
        if priority is None:
            continue
        alerts.append({
            "hotspot_id": row["hotspot_id"],
            "hotspot_type": row["hotspot_type"],
            "priority": priority,
            "PCII": float(row["PCII"]),
            "capacity_loss_pct": round(float(row["capacity_loss_pct"]), 1),
            "trend": row["trend"],
            "trend_pct": round(float(row["trend_pct"]), 1) if pd.notna(row["trend_pct"]) else None,
            "recommended_action": _recommended_action(row, priority),
            "nearest_station": row["nearest_station"],
        })

    priority_order = {"Critical": 0, "High": 1, "Medium": 2}
    alerts.sort(key=lambda a: (priority_order[a["priority"]], -a["PCII"]))
    return alerts
