import sys
import time

sys.path.insert(0, "/home/claude/gridlock_app/backend")

from app.data_pipeline import load_and_clean, fix_spatial_hotspots, compute_scores, build_hotspot_table  # noqa: E402

t0 = time.time()
print("Loading and cleaning...")
df = load_and_clean("/home/claude/gridlock_app/backend/data/violations.csv")
print(f"  shape: {df.shape}  (expected ~298450 rows)  [{time.time()-t0:.1f}s]")

print("Fixing spatial hotspots (DBSCAN)...")
df = fix_spatial_hotspots(df)
print(f"  unique hotspot_id: {df['hotspot_id'].nunique()}  [{time.time()-t0:.1f}s]")

print("Computing scores...")
df = compute_scores(df)
print(f"  impact_score range: {df['impact_score'].min()} - {df['impact_score'].max()}  [{time.time()-t0:.1f}s]")

print("Building hotspot table...")
hotspots = build_hotspot_table(df)
print(f"  final hotspot count: {len(hotspots)}  (expected 246)  [{time.time()-t0:.1f}s]")
print()
print("Hotspot type distribution (expected ~ Daily=183, Critical=32, Weekend=25, Enforcement=6):")
print(hotspots["hotspot_type"].value_counts())
print()
print("Top 5 by risk_score:")
print(hotspots.sort_values("risk_score", ascending=False)[["hotspot_id", "violations", "risk_score"]].head(5).to_string(index=False))
print()
print("Top risk driver distribution (expected mostly 'violations'):")
print(hotspots["top_risk_driver"].value_counts())
print()
print(f"Total time: {time.time()-t0:.1f}s")
