"""
forecasting.py
Builds the hotspot x week panel, trains the final validated XGBoost model
(corrected for the partial-week bug found during notebook validation),
and generates next-week forecasts with event-aware adjustment.
"""
import datetime

import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, r2_score
from xgboost import XGBRegressor

from .data_pipeline import EVENT_CALENDAR, VALIDATED_EVENT_ADJUSTMENTS

FEATURES = ["lag_1", "lag_2", "lag_3", "rolling_mean_3", "hotspot_avg_level", "week_num", "month"]
TARGET = "violations"


def _build_panel(df_valid: pd.DataFrame, valid_hotspot_ids: list) -> tuple[pd.DataFrame, list]:
    df_model_data = df_valid[df_valid["hotspot_id"].isin(valid_hotspot_ids)]
    all_weeks = sorted(df_model_data["week"].unique())

    # FIX: drop the last week if it's a partial week (< 7 distinct days of data) -
    # this was the root cause of a major forecast-distortion bug found in validation
    if len(all_weeks) > 0:
        last_week = all_weeks[-1]
        last_week_end = last_week + pd.Timedelta(days=6)
        days_in_last_week = df_model_data[
            (df_model_data["created_ist"].dt.date >= last_week.date())
            & (df_model_data["created_ist"].dt.date <= last_week_end.date())
        ]["date"].nunique()
        if days_in_last_week < 7:
            all_weeks = all_weeks[:-1]

    weekly = (
        df_model_data[df_model_data["week"].isin(all_weeks)]
        .groupby(["hotspot_id", "week"])
        .size()
        .reset_index(name="violations")
    )
    full_idx = pd.MultiIndex.from_product([valid_hotspot_ids, all_weeks], names=["hotspot_id", "week"])
    weekly_full = (
        weekly.set_index(["hotspot_id", "week"]).reindex(full_idx, fill_value=0).reset_index()
        .sort_values(["hotspot_id", "week"]).reset_index(drop=True)
    )

    weekly_full["lag_1"] = weekly_full.groupby("hotspot_id")["violations"].shift(1)
    weekly_full["lag_2"] = weekly_full.groupby("hotspot_id")["violations"].shift(2)
    weekly_full["lag_3"] = weekly_full.groupby("hotspot_id")["violations"].shift(3)
    weekly_full["rolling_mean_3"] = weekly_full.groupby("hotspot_id")["violations"].transform(
        lambda x: x.shift(1).rolling(3).mean()
    )
    weekly_full["hotspot_avg_level"] = weekly_full.groupby("hotspot_id")["violations"].transform(
        lambda x: x.shift(1).expanding().mean()
    )
    weekly_full["week_num"] = weekly_full["week"].rank(method="dense").astype(int)
    weekly_full["month"] = weekly_full["week"].dt.month

    return weekly_full, all_weeks


def train_forecast_model(df_valid: pd.DataFrame, valid_hotspot_ids: list) -> dict:
    weekly_full, all_weeks = _build_panel(df_valid, valid_hotspot_ids)
    model_df = weekly_full.dropna(subset=FEATURES).copy()

    weeks_sorted = sorted(model_df["week"].unique())
    test_weeks = weeks_sorted[-3:] if len(weeks_sorted) > 3 else weeks_sorted
    train_weeks = weeks_sorted[:-3] if len(weeks_sorted) > 3 else weeks_sorted

    train = model_df[model_df["week"].isin(train_weeks)]
    test = model_df[model_df["week"].isin(test_weeks)]

    X_train, y_train = train[FEATURES], train[TARGET]
    X_test, y_test = test[FEATURES], test[TARGET]

    model = XGBRegressor(
        n_estimators=200, max_depth=3, learning_rate=0.05,
        subsample=0.8, colsample_bytree=0.8, reg_lambda=2.0, random_state=42,
    )
    model.fit(X_train, y_train)
    test_pred = model.predict(X_test)
    train_pred = model.predict(X_train)

    test_r2 = float(r2_score(y_test, test_pred)) if len(test) > 0 else None
    test_mae = float(mean_absolute_error(y_test, test_pred)) if len(test) > 0 else None
    train_r2 = float(r2_score(y_train, train_pred))
    baseline_mae = float(mean_absolute_error(y_test, X_test["lag_1"])) if len(test) > 0 else None

    feature_importance = dict(zip(FEATURES, [float(v) for v in model.feature_importances_]))

    # Refit on ALL data for the production forecast
    X_all, y_all = model_df[FEATURES], model_df[TARGET]
    model.fit(X_all, y_all)

    latest = weekly_full.sort_values("week").groupby("hotspot_id").tail(1).copy()
    next_week_features = pd.DataFrame({
        "hotspot_id": latest["hotspot_id"],
        "lag_1": latest["violations"],
        "lag_2": latest["lag_1"],
        "lag_3": latest["lag_2"],
        "rolling_mean_3": (latest["violations"] + latest["lag_1"] + latest["lag_2"]) / 3,
        "hotspot_avg_level": (
            (latest["hotspot_avg_level"] * (latest["week_num"] - 1) + latest["violations"]) / latest["week_num"]
        ),
        "week_num": latest["week_num"] + 1,
        "month": (all_weeks[-1] + pd.Timedelta(weeks=1)).month if len(all_weeks) else 1,
    })
    forecast_pred = model.predict(next_week_features[FEATURES])
    next_week_features["forecasted_next_week_violations"] = np.round(forecast_pred).clip(min=0).astype(int)
    next_week_features["recent_avg"] = latest["rolling_mean_3"].values

    next_week_features["trend_pct"] = (
        (next_week_features["forecasted_next_week_violations"] - next_week_features["recent_avg"])
        / next_week_features["recent_avg"].replace(0, 1) * 100
    )

    def trend_label(row):
        if row["recent_avg"] < 10:
            return "Insufficient Data"
        elif row["trend_pct"] >= 20:
            return "Rising"
        elif row["trend_pct"] <= -20:
            return "Falling"
        return "Stable"

    next_week_features["trend"] = next_week_features.apply(trend_label, axis=1)

    # Event-aware adjustment layer (hybrid: ML forecast + validated rule-based bump)
    forecast_week_start = (all_weeks[-1] + pd.Timedelta(weeks=1)).date() if len(all_weeks) else None
    adjustment_pct, matched_events = get_event_adjustment(forecast_week_start) if forecast_week_start else (0.0, [])
    next_week_features["forecasted_next_week_violations_event_adjusted"] = (
        next_week_features["forecasted_next_week_violations"] * (1 + adjustment_pct)
    ).round().astype(int)

    return {
        "model": model,
        "metrics": {
            "test_r2": test_r2, "test_mae": test_mae, "train_r2": train_r2,
            "baseline_mae": baseline_mae,
            "improvement_pct": float((1 - test_mae / baseline_mae) * 100) if test_mae and baseline_mae else None,
        },
        "feature_importance": feature_importance,
        "forecast": next_week_features[
            ["hotspot_id", "forecasted_next_week_violations", "forecasted_next_week_violations_event_adjusted",
             "recent_avg", "trend_pct", "trend"]
        ],
        "forecast_week_start": str(forecast_week_start) if forecast_week_start else None,
        "matched_events": matched_events,
        "event_adjustment_pct": adjustment_pct * 100,
    }


def get_event_adjustment(forecast_week_start: datetime.date):
    forecast_week_dates = [forecast_week_start + datetime.timedelta(days=i) for i in range(7)]
    matched_events = [EVENT_CALENDAR[d] for d in forecast_week_dates if d in EVENT_CALENDAR]
    relevant = [VALIDATED_EVENT_ADJUSTMENTS[e] for e in matched_events if e in VALIDATED_EVENT_ADJUSTMENTS]
    if relevant:
        return max(relevant), matched_events
    return 0.0, matched_events
