"""
live_prediction.py
Phase-2 enhancement: "what's the illegal-parking risk at this hotspot in the
next hour?" Honest about data limits - only hours with a reliable sample
size (>=1000 city-wide records) return a real prediction; everything else
returns "Insufficient Data" instead of a guess.
"""
import pandas as pd

RELIABILITY_THRESHOLD = 1000


def build_hourly_baseline(df_valid: pd.DataFrame):
    df_valid = df_valid.copy()
    df_valid["weekday_type"] = df_valid["weekday"].isin(["Saturday", "Sunday"]).map(
        {True: "Weekend", False: "Weekday"}
    )

    hour_counts = df_valid["hour"].value_counts()
    valid_hours = sorted(hour_counts[hour_counts >= RELIABILITY_THRESHOLD].index.tolist())

    days_by_type = df_valid.drop_duplicates("date")["date"].apply(
        lambda d: "Weekend" if d.weekday() >= 5 else "Weekday"
    ).value_counts()

    hourly_baseline = (
        df_valid.groupby(["hotspot_id", "hour", "weekday_type"])
        .size()
        .reset_index(name="historical_count")
    )
    hourly_baseline["expected_per_hour"] = hourly_baseline.apply(
        lambda r: r["historical_count"] / days_by_type[r["weekday_type"]], axis=1
    )
    hourly_baseline["risk_percentile"] = (
        hourly_baseline.groupby("hotspot_id")["expected_per_hour"].rank(pct=True) * 100
    )

    return hourly_baseline, valid_hours, hour_counts


def predict_hour_risk(hourly_baseline: pd.DataFrame, valid_hours: list, hotspot_id: str, hour: int, is_weekend: bool, is_event_day: bool = False):
    if hour not in valid_hours:
        return {
            "status": "Insufficient Data",
            "reason": f"No reliable enforcement data exists for hour {hour}:00 - "
                      f"dataset only reliably covers {min(valid_hours)}:00-{max(valid_hours)}:00",
        }
    weekday_type = "Weekend" if is_weekend else "Weekday"
    row = hourly_baseline[
        (hourly_baseline["hotspot_id"] == hotspot_id)
        & (hourly_baseline["hour"] == hour)
        & (hourly_baseline["weekday_type"] == weekday_type)
    ]
    if row.empty:
        return {"status": "Insufficient Data", "reason": "No historical record for this hotspot/hour/day-type combination"}

    expected = float(row["expected_per_hour"].values[0])
    percentile = float(row["risk_percentile"].values[0])
    if is_event_day:
        expected *= 1.237  # reuse the strongest validated event multiplier (New Year Eve) as an upper bound

    risk_label = "Critical" if percentile >= 85 else "High" if percentile >= 60 else "Moderate" if percentile >= 30 else "Low"
    return {
        "status": "OK",
        "hotspot_id": hotspot_id,
        "hour": f"{hour}:00",
        "is_weekend": is_weekend,
        "is_event_day": is_event_day,
        "expected_violations_this_hour": round(expected, 1),
        "risk_percentile_for_this_location": round(percentile, 1),
        "risk_label": risk_label,
    }


def hourly_profile(hourly_baseline: pd.DataFrame, valid_hours: list, hotspot_id: str):
    rows = []
    for hour in range(24):
        for is_weekend in [False, True]:
            weekday_type = "Weekend" if is_weekend else "Weekday"
            row = hourly_baseline[
                (hourly_baseline["hotspot_id"] == hotspot_id)
                & (hourly_baseline["hour"] == hour)
                & (hourly_baseline["weekday_type"] == weekday_type)
            ]
            if hour not in valid_hours or row.empty:
                rows.append({"hour": hour, "weekday_type": weekday_type, "expected_per_hour": None, "risk_percentile": None, "has_data": False})
            else:
                rows.append({
                    "hour": hour, "weekday_type": weekday_type,
                    "expected_per_hour": round(float(row["expected_per_hour"].values[0]), 1),
                    "risk_percentile": round(float(row["risk_percentile"].values[0]), 1),
                    "has_data": True,
                })
    return rows
