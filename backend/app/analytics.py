"""
analytics.py
Repeat-offender behavioral analytics and reliability-filtered
hotspot evolution (month-over-month) analysis.
"""
import pandas as pd


def build_repeat_offenders(df: pd.DataFrame, min_violations: int = 5) -> pd.DataFrame:
    repeat = (
        df.groupby("vehicle_number")
        .agg(
            total_violations=("id", "count"),
            unique_hotspots=("hotspot_id", "nunique"),
            most_common_hotspot=("hotspot_id", lambda x: x.mode().iloc[0] if len(x.mode()) else "UNKNOWN"),
            dominant_vehicle_type=("vehicle_type", lambda x: x.mode().iloc[0] if len(x.mode()) else "UNKNOWN"),
            avg_impact_score=("impact_score", "mean"),
        )
        .reset_index()
    )
    repeat = repeat[repeat["total_violations"] >= min_violations].sort_values("total_violations", ascending=False)

    def pattern(n):
        if n == 1:
            return "Single-Location Habitual"
        elif n >= 4:
            return "Multi-Location Roamer"
        return "Limited-Area Repeater"

    repeat["behavior_pattern"] = repeat["unique_hotspots"].apply(pattern)
    return repeat


def build_multi_location_offenders(df: pd.DataFrame, min_hotspots: int = 3) -> pd.DataFrame:
    vehicle_impact = (
        df.groupby("vehicle_number")
        .agg(
            total_violations=("id", "count"),
            unique_hotspots_affected=("hotspot_id", "nunique"),
            total_impact_contribution=("impact_score", "sum"),
        )
        .reset_index()
    )
    return vehicle_impact[vehicle_impact["unique_hotspots_affected"] >= min_hotspots].sort_values(
        "total_impact_contribution", ascending=False
    )


def build_evolution(df_valid: pd.DataFrame, valid_hotspot_ids: list) -> pd.DataFrame:
    """Per-day-rate based, reliability-filtered emerging/declining analysis -
    corrects the partial-month bug found during notebook validation (raw
    monthly counts falsely showed huge 'declines' from partial first/last months)."""
    df_valid = df_valid[df_valid["hotspot_id"].isin(valid_hotspot_ids)].copy()
    df_valid["month_period"] = pd.to_datetime(df_valid["created_ist"]).dt.tz_localize(None).dt.to_period("M")

    days_per_month = df_valid.groupby(df_valid["created_ist"].dt.tz_localize(None).dt.to_period("M"))["date"].nunique()

    hotspot_monthly = df_valid.groupby(["hotspot_id", "month_period"]).size().reset_index(name="violations")
    hotspot_monthly["days_in_month"] = hotspot_monthly["month_period"].map(days_per_month.to_dict())
    hotspot_monthly["violations_per_day"] = hotspot_monthly["violations"] / hotspot_monthly["days_in_month"]

    all_months = sorted(df_valid["month_period"].unique())
    mid = len(all_months) // 2
    first_half, second_half = all_months[:mid], all_months[mid:]

    first_avg = hotspot_monthly[hotspot_monthly["month_period"].isin(first_half)].groupby("hotspot_id")["violations_per_day"].mean()
    second_avg = hotspot_monthly[hotspot_monthly["month_period"].isin(second_half)].groupby("hotspot_id")["violations_per_day"].mean()

    evo = pd.DataFrame({"first_half_avg_per_day": first_avg, "second_half_avg_per_day": second_avg}).dropna()
    evo["pct_change"] = (evo["second_half_avg_per_day"] - evo["first_half_avg_per_day"]) / evo["first_half_avg_per_day"] * 100
    evo = evo[evo["first_half_avg_per_day"] >= 0.5]
    evo["reliable"] = evo[["first_half_avg_per_day", "second_half_avg_per_day"]].min(axis=1) >= 1.0
    evo = evo.reset_index()

    city_daily = (
        df_valid.groupby(df_valid["created_ist"].dt.tz_localize(None).dt.to_period("M")).size() / days_per_month
    )
    city_trend = {str(k): round(float(v), 1) for k, v in city_daily.items()}

    return evo, city_trend
