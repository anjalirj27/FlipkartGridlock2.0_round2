"""
congestion_simulator.py
Phase-2 enhancement: layers the established Bureau of Public Roads (BPR)
volume-delay function on top of the validated capacity_loss_pct metric, to
show the INCREMENTAL travel-time impact attributable specifically to
illegal parking at a hotspot - not an invented "congestion index".
"""
import numpy as np

BASE_CAPACITY_PCU_PER_HOUR = 2800  # ~7.2m 2-lane Indian urban road, mixed traffic (documented)
BPR_ALPHA = 0.15
BPR_BETA = 4

MAX_CAPACITY_LOSS_FOR_BPR = 70.0  # BPR's (V/C)^4 term is numerically degenerate near C=0
GRIDLOCK_RATIO_THRESHOLD = 8.0


def bpr_travel_time_ratio(volume, capacity):
    if capacity <= 0:
        return float("inf")
    return 1 + BPR_ALPHA * (volume / capacity) ** BPR_BETA


def congestion_impact(capacity_loss_pct_raw: float, vc_ratio_background: float):
    capacity_loss_pct = min(capacity_loss_pct_raw, MAX_CAPACITY_LOSS_FOR_BPR)
    C_original = BASE_CAPACITY_PCU_PER_HOUR
    C_effective = C_original * (1 - capacity_loss_pct / 100)
    V = vc_ratio_background * C_original

    ratio_without = bpr_travel_time_ratio(V, C_original)
    ratio_with = bpr_travel_time_ratio(V, C_effective)
    is_gridlock = ratio_with >= GRIDLOCK_RATIO_THRESHOLD

    congestion_increase_pct = (ratio_with - ratio_without) / ratio_without * 100
    indicative_speed_drop_pct = (1 - ratio_without / ratio_with) * 100

    return {
        "capacity_loss_pct_used": round(capacity_loss_pct, 1),
        "capacity_loss_capped": capacity_loss_pct_raw > MAX_CAPACITY_LOSS_FOR_BPR,
        "capacity_loss_pct_actual": round(capacity_loss_pct_raw, 1),
        "travel_time_ratio_without_illegal_parking": round(ratio_without, 2),
        "travel_time_ratio_with_illegal_parking": None if is_gridlock else round(ratio_with, 2),
        "is_gridlock": is_gridlock,
        "extra_congestion_pct": None if is_gridlock else round(congestion_increase_pct, 1),
        "indicative_speed_drop_pct": 95.0 if is_gridlock else round(indicative_speed_drop_pct, 1),
    }


def congestion_curve(capacity_loss_pct_raw: float, points: int = 40):
    """Returns the full BPR curve (both with/without illegal parking) for charting."""
    capacity_loss_pct = min(capacity_loss_pct_raw, MAX_CAPACITY_LOSS_FOR_BPR)
    C_original = BASE_CAPACITY_PCU_PER_HOUR
    C_effective = C_original * (1 - capacity_loss_pct / 100)

    vc_range = np.linspace(0.1, 1.0, points)
    curve = []
    for vc in vc_range:
        V = vc * C_original
        curve.append({
            "vc_ratio": round(float(vc), 3),
            "ratio_without": round(min(bpr_travel_time_ratio(V, C_original), 10), 3),
            "ratio_with": round(min(bpr_travel_time_ratio(V, C_effective), 10), 3),
        })
    return curve
