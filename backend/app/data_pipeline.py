"""
data_pipeline.py
Loads the raw violation CSV and produces a fully cleaned, scored,
hotspot-level dataset. This ports the FINAL, validated logic from the
Gridlock Hackathon notebook - all dead-end/buggy intermediate attempts
(naive mean impact, percentile-tie classification, unscaled normalization)
are intentionally excluded; only the corrected versions are implemented here.
"""
import ast
import datetime
from collections import Counter

import numpy as np
import pandas as pd
from sklearn.cluster import DBSCAN
from sklearn.preprocessing import MinMaxScaler

EARTH_RADIUS_KM = 6371.0088

# ---------------------------------------------------------------
# Reference maps (validated, all categories mapped - see notebook Section 8)
# ---------------------------------------------------------------
SEVERITY_MAP = {
    "PARKING IN A MAIN ROAD": 6, "AGAINST ONE WAY/NO ENTRY": 6,
    "JUMPING TRAFFIC SIGNAL": 6, "H T V PROHIBITED": 6,
    "DOUBLE PARKING": 5, "PARKING NEAR ROAD CROSSING": 5,
    "PARKING NEAR TRAFFIC LIGHT OR ZEBRA CROSS": 5,
    "PARKING OPPOSITE TO ANOTHER PARKED VEHICLE": 5, "OBSTRUCTING DRIVER": 5,
    "PARKING NEAR BUSTOP/SCHOOL/HOSPITAL ETC": 4, "U TURN PROHIBITED": 4,
    "CARRYING LENGHTY MATERIAL": 4, "VIOLATING LANE DISIPLINE": 4,
    "STOPING ON WHITE/STOP LINE": 4,
    "PARKING ON FOOTPATH": 3, "PARKING OTHER THAN BUS STOP": 3,
    "WRONG PARKING": 2, "NO PARKING": 2,
    "DEFECTIVE NUMBER PLATE": 0, "USING BLACK FILM/OTHER MATERIALS": 0,
    "WITHOUT SIDE MIRROR": 0, "FAIL TO USE SAFETY BELTS": 0,
    "RIDER NOT WEARING HELMET": 0, "2W/3W - USING MOBILE PHONE": 0,
    "OTHER - USING MOBILE PHONE": 0, "REFUSE TO GO FOR HIRE": 0,
    "DEMANDING EXCESS FARE": 0,
}

VEHICLE_FACTOR = {
    "SCOOTER": 1.0, "MOTOR CYCLE": 1.0, "MOPED": 1.0,
    "CAR": 1.5, "PASSENGER AUTO": 1.5, "JEEP": 1.5, "VAN": 1.5,
    "MAXI-CAB": 2.0, "GOODS AUTO": 2.0, "LGV": 2.0, "TEMPO": 2.0,
    "BUS (BMTC/KSRTC)": 3.0, "PRIVATE BUS": 3.0, "TOURIST BUS": 3.0,
    "SCHOOL VEHICLE": 3.0, "FACTORY BUS": 3.0,
    "LORRY/GOODS VEHICLE": 3.5, "HGV": 3.5, "TANKER": 3.5,
    "TRACTOR": 3.0, "MINI LORRY": 2.5, "OTHERS": 1.5,
}
DEFAULT_VEHICLE_FACTOR = 1.5

EVENT_CALENDAR = {
    datetime.date(2023, 11, 12): "Diwali",
    datetime.date(2023, 11, 29): "Bengaluru Tech Summit (Day 1)",
    datetime.date(2023, 11, 30): "Bengaluru Tech Summit (Day 2)",
    datetime.date(2023, 12, 1): "Bengaluru Tech Summit (Day 3)",
    datetime.date(2023, 12, 25): "Christmas",
    datetime.date(2023, 12, 31): "New Year Eve",
    datetime.date(2024, 1, 1): "New Year Day",
    datetime.date(2024, 1, 15): "Makar Sankranti",
    datetime.date(2024, 1, 26): "Republic Day",
    datetime.date(2024, 2, 14): "Valentine's Day",
    datetime.date(2024, 3, 8): "Maha Shivaratri",
    datetime.date(2024, 3, 25): "Holi + IPL (RCB vs PBKS)",
    datetime.date(2024, 3, 29): "Good Friday + IPL (RCB vs KKR)",
    datetime.date(2024, 4, 2): "IPL (RCB vs LSG)",
}
# Statistically validated event-impact percentages (same-weekday baseline
# comparison, confirmed from real computed output). The Tech Summit's effect
# was only confirmed as a VENUE-SPECIFIC finding (within 2km of Bangalore
# Palace: +37.6%) - no generic city-wide day-level Tech Summit number was
# ever confirmed, so it is deliberately NOT included here to avoid using an
# unverified figure.
VALIDATED_EVENT_ADJUSTMENTS = {
    "New Year Eve": 0.237,
    "Diwali": 0.124,
}

BAD_STATUS = {"rejected", "duplicate"}
MIN_VIOLATIONS = 30
EPS_KM = 0.30
DBSCAN_MIN_SAMPLES = 15
SHRINKAGE_K = 50


def haversine_km(lat1, lon1, lat2, lon2):
    lat1, lon1, lat2, lon2 = map(np.radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = np.sin(dlat / 2) ** 2 + np.cos(lat1) * np.cos(lat2) * np.sin(dlon / 2) ** 2
    return 2 * EARTH_RADIUS_KM * np.arcsin(np.sqrt(a))


def _safe_parse(x):
    try:
        return ast.literal_eval(x) if pd.notna(x) else []
    except Exception:
        return []


def load_and_clean(csv_path: str) -> pd.DataFrame:
    df = pd.read_csv(csv_path)

    cols_to_drop = [c for c in ["description", "closed_datetime", "action_taken_timestamp"] if c in df.columns]
    df = df.drop(columns=cols_to_drop)

    df["created_datetime"] = pd.to_datetime(df["created_datetime"], format="mixed", utc=True)
    df["created_ist"] = df["created_datetime"].dt.tz_convert("Asia/Kolkata")

    df["hour"] = df["created_ist"].dt.hour
    df["weekday"] = df["created_ist"].dt.day_name()
    df["month"] = df["created_ist"].dt.month_name()
    df["date"] = df["created_ist"].dt.date
    df["is_weekend"] = df["weekday"].isin(["Saturday", "Sunday"])
    df["week"] = pd.to_datetime(df["created_ist"].dt.to_period("W").apply(lambda r: r.start_time.date()))

    df["event_name"] = df["date"].map(EVENT_CALENDAR)
    df["is_event_day"] = df["event_name"].notna()

    df["violation_list"] = df["violation_type"].apply(_safe_parse)

    df = df.dropna(subset=["latitude", "longitude"]).copy()

    BAD = BAD_STATUS
    df["is_valid_for_scoring"] = ~df["validation_status"].isin(BAD)

    return df


def fix_spatial_hotspots(df: pd.DataFrame) -> pd.DataFrame:
    """DBSCAN-based fix for the 'No Junction' fragmentation problem."""
    df["hotspot_id"] = df["junction_name"]
    no_junction_mask = df["junction_name"] == "No Junction"
    nj_coords = df.loc[no_junction_mask, ["latitude", "longitude"]]

    if len(nj_coords) > 0:
        coords_rad = np.radians(nj_coords.to_numpy())
        eps_rad = EPS_KM / EARTH_RADIUS_KM
        dbscan = DBSCAN(eps=eps_rad, min_samples=DBSCAN_MIN_SAMPLES, metric="haversine", algorithm="ball_tree")
        clusters = dbscan.fit_predict(coords_rad)

        df.loc[no_junction_mask, "cluster_id"] = clusters
        nj_with_loc = df.loc[no_junction_mask, ["location"]].copy()
        nj_with_loc["cluster"] = clusters

        cluster_names = {}
        for cid in set(clusters):
            if cid == -1:
                continue
            subset = nj_with_loc.loc[nj_with_loc["cluster"] == cid, "location"]
            mode_loc = subset.mode()
            name = mode_loc.iloc[0] if len(mode_loc) > 0 else "Unknown Area"
            short_name = name.split(",")[0].strip() if isinstance(name, str) else "Unknown Area"
            cluster_names[cid] = f"Cluster: {short_name}"

        def assign_nj_hotspot(row):
            cid = row["cluster_id"]
            if pd.isna(cid) or cid == -1:
                return f"Unclustered: {str(row['location']).split(',')[0].strip()}"
            return cluster_names.get(int(cid), "Unknown Area")

        mask_idx = df.index[no_junction_mask]
        df.loc[mask_idx, "hotspot_id"] = df.loc[mask_idx].apply(assign_nj_hotspot, axis=1)

    return df


def compute_scores(df: pd.DataFrame) -> pd.DataFrame:
    def congestion_score(vlist):
        if not vlist:
            return 0
        return sum(SEVERITY_MAP.get(v, 0) for v in vlist)

    df["congestion_score"] = df["violation_list"].apply(congestion_score)
    df["vehicle_factor"] = df["vehicle_type"].map(VEHICLE_FACTOR).fillna(DEFAULT_VEHICLE_FACTOR)
    df["impact_score"] = df["congestion_score"] * df["vehicle_factor"]

    vehicle_repeat = df.groupby("vehicle_number").size().reset_index(name="repeat_count")
    df = df.merge(vehicle_repeat, on="vehicle_number", how="left")

    # Economic loss estimation (documented, illustrative planning-level assumptions)
    DELAY_MINUTES_PER_IMPACT_POINT = 2.5
    AVG_VEHICLE_OCCUPANCY = 1.4
    VALUE_OF_TIME_PER_HOUR = 120
    FUEL_PRICE_PER_LITER = 102
    IDLE_FUEL_LITERS_PER_MINUTE = 0.012

    df["vehicle_minutes_lost"] = df["impact_score"] * DELAY_MINUTES_PER_IMPACT_POINT
    df["time_cost_rs"] = (df["vehicle_minutes_lost"] / 60) * AVG_VEHICLE_OCCUPANCY * VALUE_OF_TIME_PER_HOUR
    df["fuel_cost_rs"] = df["vehicle_minutes_lost"] * IDLE_FUEL_LITERS_PER_MINUTE * FUEL_PRICE_PER_LITER
    df["economic_loss_rs"] = df["time_cost_rs"] + df["fuel_cost_rs"]

    return df


def build_hotspot_table(df: pd.DataFrame) -> pd.DataFrame:
    """Aggregate to hotspot level, apply shrinkage + log-normalization fix, score, classify."""
    df_valid = df[df["is_valid_for_scoring"]].copy()

    hotspots = (
        df_valid.groupby("hotspot_id")
        .agg(
            violations=("id", "count"),
            unique_vehicles=("vehicle_number", "nunique"),
            avg_repeat_count=("repeat_count", "mean"),
            weekend_ratio=("is_weekend", "mean"),
            latitude=("latitude", "mean"),
            longitude=("longitude", "mean"),
            dominant_vehicle=("vehicle_type", lambda x: x.mode().iloc[0] if len(x.mode()) else "UNKNOWN"),
            dominant_police_station=("police_station", lambda x: x.mode().iloc[0] if len(x.mode()) else "UNKNOWN"),
        )
        .reset_index()
    )

    hotspots = hotspots[hotspots["violations"] >= MIN_VIOLATIONS].copy()

    impact_median_by_hotspot = df_valid.groupby("hotspot_id")["impact_score"].median()
    hotspots["impact_score_median"] = hotspots["hotspot_id"].map(impact_median_by_hotspot)

    city_baseline_impact = df_valid["impact_score"].median()
    hotspots["impact_score"] = (
        hotspots["violations"] * hotspots["impact_score_median"] + SHRINKAGE_K * city_baseline_impact
    ) / (hotspots["violations"] + SHRINKAGE_K)

    hotspots["vehicle_diversity"] = hotspots["unique_vehicles"] / hotspots["violations"]

    # FIX: log-transform heavy-tailed metrics before MinMax scaling (corrects the
    # outlier-compression bug found in the notebook - see Section "Explainable AI")
    hotspots["violations_log"] = np.log1p(hotspots["violations"])
    hotspots["unique_vehicles_log"] = np.log1p(hotspots["unique_vehicles"])

    scaler = MinMaxScaler()
    norm_input = hotspots[["violations_log", "unique_vehicles_log", "impact_score", "avg_repeat_count"]]
    hotspots[["violations_norm", "vehicles_norm", "impact_norm", "repeat_norm"]] = scaler.fit_transform(norm_input)

    hotspots["risk_score"] = (
        0.40 * hotspots["violations_norm"]
        + 0.25 * hotspots["vehicles_norm"]
        + 0.20 * hotspots["impact_norm"]
        + 0.15 * hotspots["repeat_norm"]
    )
    hotspots = hotspots.sort_values("risk_score", ascending=False).reset_index(drop=True)

    # Classification - using risk_score (not impact_score) to avoid the
    # tied-score bug found during validation
    critical_threshold = hotspots["risk_score"].quantile(0.85)

    def classify(row):
        if row["avg_repeat_count"] >= 4 and row["vehicle_diversity"] <= 0.65:
            return "Enforcement Failure Zone"
        elif row["weekend_ratio"] >= 0.45:
            return "Weekend Congestion Zone"
        elif row["risk_score"] >= critical_threshold:
            return "Critical Impact Zone"
        return "Daily Congestion Zone"

    hotspots["hotspot_type"] = hotspots.apply(classify, axis=1)

    def recommend(row):
        t = row["hotspot_type"]
        if t == "Enforcement Failure Zone":
            return "Deploy towing patrol + repeat-offender monitoring"
        elif t == "Critical Impact Zone":
            return "High-priority enforcement: severe congestion impact"
        elif t == "Weekend Congestion Zone":
            return "Increase weekend patrol presence"
        return "Routine peak-hour enforcement deployment"

    hotspots["recommendation"] = hotspots.apply(recommend, axis=1)

    # Explainability: per-hotspot risk breakdown + dominant driver
    def explain(row):
        contrib = {
            "violations": round(0.40 * row["violations_norm"], 3),
            "unique_vehicles": round(0.25 * row["vehicles_norm"], 3),
            "impact_severity": round(0.20 * row["impact_norm"], 3),
            "repeat_offenders": round(0.15 * row["repeat_norm"], 3),
        }
        return contrib, max(contrib, key=contrib.get)

    breakdown_pairs = hotspots.apply(explain, axis=1)
    hotspots["risk_breakdown"] = breakdown_pairs.apply(lambda p: p[0])
    hotspots["top_risk_driver"] = breakdown_pairs.apply(lambda p: p[1])

    # Citizen trust score (uses FULL data incl. rejected/duplicate)
    trust = (
        df.groupby("hotspot_id")
        .agg(
            total_reports=("id", "count"),
            approved=("validation_status", lambda x: (x == "approved").sum()),
            rejected=("validation_status", lambda x: (x == "rejected").sum()),
            duplicate=("validation_status", lambda x: (x == "duplicate").sum()),
        )
        .reset_index()
    )
    trust["trust_score"] = trust["approved"] / trust["total_reports"].clip(lower=1)
    hotspots = hotspots.merge(trust[["hotspot_id", "trust_score", "rejected", "duplicate"]], on="hotspot_id", how="left")

    # Economic loss per hotspot (annualized)
    dataset_days = (df_valid["date"].max() - df_valid["date"].min()).days
    hotspot_loss = df_valid.groupby("hotspot_id")["economic_loss_rs"].sum().reset_index()
    hotspot_loss["annualized_economic_loss_rs"] = hotspot_loss["economic_loss_rs"] * (365 / dataset_days)
    hotspots = hotspots.merge(
        hotspot_loss[["hotspot_id", "annualized_economic_loss_rs"]], on="hotspot_id", how="left"
    )

    # Repeat-offender concentration per hotspot
    repeat_summary = (
        df.groupby("hotspot_id")
        .agg(
            vehicles_seen_5plus_times=("vehicle_number", lambda x: x.value_counts().ge(5).sum()),
        )
        .reset_index()
    )
    hotspots = hotspots.merge(repeat_summary, on="hotspot_id", how="left")

    return hotspots
