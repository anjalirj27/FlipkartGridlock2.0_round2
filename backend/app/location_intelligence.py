"""
location_intelligence.py
Phase-2 enhancement: proximity to verified major Namma Metro stations.
Real, verified coordinates only (Wikipedia/BMRCL) - no fabricated percentages.
"""
import pandas as pd

from .data_pipeline import haversine_km

METRO_STATIONS = {
    "Majestic (Kempegowda) - Purple/Green interchange": (12.975692, 77.572836),
    "MG Road": (12.975536, 77.606830),
    "Sir M. Visveshwaraya / Central College": (12.974104, 77.584017),
    "Hosahalli (Vijayanagar interchange)": (12.974178, 77.545538),
    "Mahakavi Kuvempu Road": (12.998456, 77.556951),
    "South End Circle (Basavanagudi)": (12.938237, 77.580076),
    "Yelachenahalli": (12.895983, 77.570159),
    "Peenya Industry": (13.036341, 77.525465),
    "Doddakallasandra": (12.884714, 77.552846),
    "Singayyanapalya (Mahadevapura)": (12.996780, 77.692170),
    "Manjunath Nagar": (13.050137, 77.494413),
    "Lalbagh": (12.946355, 77.580050),
    "Nallurhalli (Whitefield)": (12.976528, 77.724763),
    "Peenya": (13.032921, 77.533297),
    "Attiguppe": (12.961957, 77.533582),
    "Silk Institute": (12.861858, 77.530007),
    "City Railway Station (Krantivira Sangolli Rayanna)": (12.975814, 77.565708),
}

RADIUS_KM = 1.0


def min_distance_to_metro(lat, lon):
    dists = [haversine_km(lat, lon, slat, slon) for slat, slon in METRO_STATIONS.values()]
    return min(dists)


def compute_metro_proximity(hotspots: pd.DataFrame) -> pd.DataFrame:
    hotspots = hotspots.copy()
    hotspots["dist_to_nearest_metro_km"] = hotspots.apply(
        lambda r: round(min_distance_to_metro(r["latitude"], r["longitude"]), 3), axis=1
    )
    hotspots["near_metro"] = hotspots["dist_to_nearest_metro_km"] <= RADIUS_KM
    return hotspots


def location_intelligence_summary(hotspots: pd.DataFrame) -> dict:
    near = hotspots[hotspots["near_metro"]]
    far = hotspots[~hotspots["near_metro"]]
    return {
        "metro_station_count": len(METRO_STATIONS),
        "radius_km": RADIUS_KM,
        "hotspots_near_metro": int(len(near)),
        "total_hotspots": int(len(hotspots)),
        "violations_share_near_metro_pct": round(
            float(near["violations"].sum() / hotspots["violations"].sum() * 100), 1
        ) if len(near) else 0.0,
        "avg_risk_near_metro": round(float(near["risk_score"].mean()), 3) if len(near) else 0.0,
        "avg_risk_far_from_metro": round(float(far["risk_score"].mean()), 3) if len(far) else 0.0,
        "metro_stations": [{"name": k, "latitude": v[0], "longitude": v[1]} for k, v in METRO_STATIONS.items()],
    }
