import sys
import time

sys.path.insert(0, "/home/claude/gridlock_app/backend")

from app.data_pipeline import load_and_clean, fix_spatial_hotspots, compute_scores, build_hotspot_table  # noqa: E402
from app.forecasting import train_forecast_model  # noqa: E402
from app.patrol_optimizer import compute_station_locations, attach_nearest_station, allocate_patrol, budget_sensitivity  # noqa: E402
from app.analytics import build_repeat_offenders, build_multi_location_offenders, build_evolution  # noqa: E402

t0 = time.time()
df = load_and_clean("/home/claude/gridlock_app/backend/data/violations.csv")
df = fix_spatial_hotspots(df)
df = compute_scores(df)
hotspots = build_hotspot_table(df)
df_valid = df[df["is_valid_for_scoring"]]
valid_ids = hotspots["hotspot_id"].tolist()
print(f"Setup done [{time.time()-t0:.1f}s]")

print("\n--- FORECASTING ---")
result = train_forecast_model(df_valid, valid_ids)
print("Metrics:", result["metrics"], f"  (expect test_r2 ~0.85+)")
print("Forecast week:", result["forecast_week_start"], "matched_events:", result["matched_events"])
print(result["forecast"].head(3))
print(f"[{time.time()-t0:.1f}s]")

print("\n--- PATROL OPTIMIZER ---")
stations = compute_station_locations(df_valid)
hotspots2 = attach_nearest_station(hotspots.copy(), stations)
allocated = allocate_patrol(hotspots2, 50)
print("Patrol allocated:", allocated["patrol_allocated"].sum(), "(expect 46)")
sens = budget_sensitivity(allocated, [10, 50, 100, 284])
print("Sensitivity:", sens)
print(f"[{time.time()-t0:.1f}s]")

print("\n--- REPEAT OFFENDERS ---")
repeat = build_repeat_offenders(df)
print("Repeat offenders (5+):", len(repeat), "(expect 3489)")
print(repeat["behavior_pattern"].value_counts())
multi = build_multi_location_offenders(df)
print("Multi-location (3+ hotspots):", len(multi), "(expect 1174)")
print(f"[{time.time()-t0:.1f}s]")

print("\n--- EVOLUTION ---")
evo, city_trend = build_evolution(df_valid, valid_ids)
print("City trend:", city_trend)
print("Reliable hotspots:", evo["reliable"].sum(), "/", len(evo))
print(f"[{time.time()-t0:.1f}s]")

print(f"\nTOTAL: {time.time()-t0:.1f}s")
