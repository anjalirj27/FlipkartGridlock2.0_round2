"""
build_cache.py
Runs the full analytical pipeline ONCE and caches every result to disk
(pickle), so the FastAPI server can start instantly instead of
recomputing DBSCAN + XGBoost + repeat-offender aggregation on every boot.
Run this manually whenever the underlying CSV changes:
    python3 build_cache.py
"""
import os
import pickle
import time
import urllib.request

from app.data_pipeline import (
    load_and_clean, fix_spatial_hotspots, compute_scores, build_hotspot_table,
)
from app.forecasting import train_forecast_model
from app.patrol_optimizer import compute_station_locations, attach_nearest_station, allocate_patrol
from app.analytics import build_repeat_offenders, build_multi_location_offenders, build_evolution
from app.road_capacity import compute_capacity_loss, before_after_enforcement, roi_calculation
from app.location_intelligence import compute_metro_proximity, location_intelligence_summary
from app.live_prediction import build_hourly_baseline

CSV_PATH = "data/violations.csv"
CACHE_PATH = "data/cache.pkl"
# Used for cloud deploys (e.g. Render) where the 105MB raw CSV isn't committed
# to git. Override with the DATASET_URL environment variable if needed.
DATASET_URL = os.environ.get(
    "DATASET_URL",
    "https://huggingface.co/datasets/anji2705/fghack2/resolve/main/violations.csv?download=true",
)
DEFAULT_PATROL_BUDGET = 50


def ensure_dataset():
    if os.path.exists(CSV_PATH) and os.path.getsize(CSV_PATH) > 0:
        print(f"Dataset already present at {CSV_PATH}")
        return
    os.makedirs(os.path.dirname(CSV_PATH), exist_ok=True)
    print(f"Dataset not found locally - downloading from {DATASET_URL} ...")
    urllib.request.urlretrieve(DATASET_URL, CSV_PATH)
    size_mb = os.path.getsize(CSV_PATH) / 1e6
    print(f"Downloaded {size_mb:.1f} MB to {CSV_PATH}")


def main():
    ensure_dataset()
    t0 = time.time()
    print("Loading and cleaning...")

    df = load_and_clean(CSV_PATH)
    print(f"  [{time.time()-t0:.1f}s]")

    print("Fixing spatial hotspots...")
    df = fix_spatial_hotspots(df)
    print(f"  [{time.time()-t0:.1f}s]")

    print("Computing scores...")
    df = compute_scores(df)
    print(f"  [{time.time()-t0:.1f}s]")

    print("Building hotspot table...")
    hotspots = build_hotspot_table(df)
    df_valid = df[df["is_valid_for_scoring"]].copy()
    valid_ids = hotspots["hotspot_id"].tolist()
    print(f"  {len(hotspots)} hotspots  [{time.time()-t0:.1f}s]")

    print("Attaching nearest police stations...")
    stations = compute_station_locations(df_valid)
    hotspots = attach_nearest_station(hotspots, stations)
    print(f"  [{time.time()-t0:.1f}s]")

    print("Training forecast model...")
    forecast_result = train_forecast_model(df_valid, valid_ids)
    hotspots = hotspots.merge(
        forecast_result["forecast"][
            ["hotspot_id", "forecasted_next_week_violations",
             "forecasted_next_week_violations_event_adjusted", "trend_pct", "trend"]
        ],
        on="hotspot_id", how="left",
    )
    print(f"  test_r2={forecast_result['metrics']['test_r2']:.3f}  [{time.time()-t0:.1f}s]")

    print("Repeat offender analytics...")
    repeat_offenders = build_repeat_offenders(df)
    multi_location = build_multi_location_offenders(df)
    print(f"  [{time.time()-t0:.1f}s]")

    print("Hotspot evolution...")
    evolution, city_trend = build_evolution(df_valid, valid_ids)
    hotspots = hotspots.merge(
        evolution[["hotspot_id", "pct_change", "reliable"]].rename(
            columns={"pct_change": "evolution_pct_change", "reliable": "evolution_reliable"}
        ),
        on="hotspot_id", how="left",
    )
    print(f"  [{time.time()-t0:.1f}s]")

    print("Baking in the default 50-unit patrol allocation (for before/after + ROI)...")
    hotspots = allocate_patrol(hotspots, DEFAULT_PATROL_BUDGET)
    print(f"  {int(hotspots['patrol_allocated'].sum())} hotspots allocated  [{time.time()-t0:.1f}s]")

    print("PHASE 2: Road Capacity Loss Model + PCII...")
    hotspots = compute_capacity_loss(df_valid, hotspots)
    print(f"  [{time.time()-t0:.1f}s]")

    print("PHASE 2: Before/After enforcement + ROI...")
    before_after = before_after_enforcement(hotspots)
    roi = roi_calculation(hotspots)
    print(f"  savings/yr = Rs.{roi['annual_savings_rs']:,}  [{time.time()-t0:.1f}s]")

    print("PHASE 2: Location intelligence (metro proximity)...")
    hotspots = compute_metro_proximity(hotspots)
    location_intel = location_intelligence_summary(hotspots)
    print(f"  [{time.time()-t0:.1f}s]")

    print("PHASE 2: Live prediction hourly baseline...")
    hourly_baseline, valid_hours, hour_counts = build_hourly_baseline(df_valid)
    print(f"  reliable hours: {valid_hours}  [{time.time()-t0:.1f}s]")

    print("Computing executive summary...")
    dataset_days = (df["date"].max() - df["date"].min()).days
    total_loss = df_valid["economic_loss_rs"].sum()
    annualized_loss = total_loss * (365 / dataset_days)
    summary = {
        "total_records": int(len(df)),
        "validated_records": int(df["is_valid_for_scoring"].sum()),
        "excluded_records": int((~df["is_valid_for_scoring"]).sum()),
        "date_min": str(df["date"].min()),
        "date_max": str(df["date"].max()),
        "total_hotspots": int(len(hotspots)),
        "hotspot_type_counts": hotspots["hotspot_type"].value_counts().to_dict(),
        "annualized_economic_loss_rs": float(annualized_loss),
        "top10_loss_share_pct": float(
            hotspots.sort_values("annualized_economic_loss_rs", ascending=False)["annualized_economic_loss_rs"].head(10).sum()
            / hotspots["annualized_economic_loss_rs"].sum() * 100
        ),
        "repeat_offender_count": int(len(repeat_offenders)),
        "avg_trust_score": float(hotspots["trust_score"].mean()),
        "forecast_metrics": forecast_result["metrics"],
        "feature_importance": forecast_result["feature_importance"],
        "peak_hour": int(df["hour"].value_counts().idxmax()),
        "peak_hour_daily_avg": float(df[df["hour"] == df["hour"].value_counts().idxmax()].groupby("date").size().mean()),
        "avg_economic_loss_per_violation_rs": float(df_valid["economic_loss_rs"].mean()),
        "enforcement_hours_valid": valid_hours,
        "before_after_enforcement": before_after,
        "roi": roi,
        "location_intelligence": location_intel,
    }
    print(f"  [{time.time()-t0:.1f}s]")

    cache = {
        "hotspots": hotspots,
        "stations": stations,
        "repeat_offenders": repeat_offenders,
        "multi_location": multi_location,
        "evolution": evolution,
        "city_trend": city_trend,
        "summary": summary,
        "hourly_baseline": hourly_baseline,
        "valid_hours": valid_hours,
        "df_valid_slim": df_valid[
            ["id", "hotspot_id", "vehicle_number", "vehicle_type", "violation_type",
             "impact_score", "economic_loss_rs", "date", "hour", "weekday", "is_event_day", "event_name"]
        ],
    }
    with open(CACHE_PATH, "wb") as f:
        pickle.dump(cache, f)

    print(f"\nCache saved to {CACHE_PATH}  [TOTAL {time.time()-t0:.1f}s]")


if __name__ == "__main__":
    main()
