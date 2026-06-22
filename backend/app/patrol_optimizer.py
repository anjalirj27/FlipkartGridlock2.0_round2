"""
patrol_optimizer.py
Police-station approximation, nearest-station distance, and the
greedy knapsack patrol-unit allocator with budget sensitivity simulation.
"""
import pandas as pd

from .data_pipeline import haversine_km

UNITS_REQUIRED_MAP = {
    "Enforcement Failure Zone": 2,
    "Critical Impact Zone": 2,
    "Weekend Congestion Zone": 1,
    "Daily Congestion Zone": 1,
}


def compute_station_locations(df_valid: pd.DataFrame) -> pd.DataFrame:
    return (
        df_valid.groupby("police_station")
        .agg(
            station_lat=("latitude", "mean"),
            station_lon=("longitude", "mean"),
            total_violations_handled=("id", "count"),
        )
        .reset_index()
    )


def attach_nearest_station(hotspots: pd.DataFrame, station_locations: pd.DataFrame) -> pd.DataFrame:
    def find_nearest(lat, lon):
        distances = haversine_km(lat, lon, station_locations["station_lat"].values, station_locations["station_lon"].values)
        idx = distances.argmin()
        return station_locations.iloc[idx]["police_station"], float(distances[idx])

    results = hotspots.apply(lambda row: find_nearest(row["latitude"], row["longitude"]), axis=1)
    hotspots["nearest_station"] = [r[0] for r in results]
    hotspots["distance_to_station_km"] = [round(r[1], 2) for r in results]
    return hotspots


def allocate_patrol(hotspots: pd.DataFrame, total_units: int) -> pd.DataFrame:
    hotspots = hotspots.copy()
    hotspots["units_required"] = hotspots["hotspot_type"].map(UNITS_REQUIRED_MAP)
    hotspots["risk_per_unit"] = hotspots["risk_score"] / hotspots["units_required"]

    ranked = hotspots.sort_values("risk_per_unit", ascending=False)
    allocated, units_used = [], 0
    for _, row in ranked.iterrows():
        if units_used + row["units_required"] <= total_units:
            allocated.append(row["hotspot_id"])
            units_used += row["units_required"]

    hotspots["patrol_allocated"] = hotspots["hotspot_id"].isin(allocated)
    return hotspots


def budget_sensitivity(hotspots: pd.DataFrame, budgets: list[int]) -> list[dict]:
    total_risk_all = hotspots["risk_score"].sum()
    ranked = hotspots.sort_values("risk_score" if "risk_per_unit" not in hotspots else "risk_per_unit", ascending=False)

    results = []
    for budget in budgets:
        used, covered = 0, 0.0
        for _, row in ranked.iterrows():
            if used + row["units_required"] <= budget:
                used += row["units_required"]
                covered += row["risk_score"]
        results.append({"patrol_units": budget, "coverage_pct": round(covered / total_risk_all * 100, 2)})
    return results
