"""Time-series stationarity testing, lag autocorrelation, and trend extraction."""

from dataclasses import dataclass

import numpy as np
import pandas as pd
from statsmodels.tsa.stattools import adfuller


@dataclass
class TimeSeriesResult:
    """Artifacts from time-series diagnostic analysis."""

    datetime_column: str
    metric_column: str
    total_observations: int
    adf_statistic: float | None
    adf_p_value: float | None
    is_stationary: bool | None
    critical_values: dict[str, float]
    stationarity_interpretation: str
    lag_autocorrelations: list[dict[str, float | int]]
    chart_series: list[dict[str, str | float]]
    trend_summary: str


def analyze_timeseries(
    df: pd.DataFrame,
    dt_col: str,
    metric_col: str,
) -> TimeSeriesResult | None:
    """Computes ADF stationarity test and autocorrelation series."""
    clean = df[[dt_col, metric_col]].dropna().copy()
    clean[metric_col] = pd.to_numeric(clean[metric_col], errors="coerce")
    if len(clean) < 15:
        return None

    try:
        clean[dt_col] = pd.to_datetime(clean[dt_col], errors="coerce")
        clean = clean.dropna().sort_values(by=dt_col)
    except Exception:
        return None

    metric_vals = pd.to_numeric(clean[metric_col], errors="coerce").dropna().values
    if len(metric_vals) < 15:
        return None

    # ADF Test for Stationarity
    try:
        dates = clean[dt_col]
        if dates.duplicated().any() or dates.diff().dropna().nunique() != 1:
            raise ValueError("ADF requires unique timestamps at regular intervals")
        adf_out = adfuller(metric_vals, maxlag=min(12, len(metric_vals) // 2 - 2), autolag="AIC", result_object=False)
        adf_stat = float(adf_out[0])
        adf_p = float(adf_out[1])
        if not np.isfinite(adf_stat) or not np.isfinite(adf_p):
            raise ValueError("ADF did not return finite statistics")
        crit_vals = {str(k): round(float(v), 3) for k, v in adf_out[4].items()}
        is_stat = adf_p < 0.05
    except Exception:
        adf_stat, adf_p = None, None
        crit_vals = {}
        is_stat = None

    if is_stat is None:
        interp = "ADF is unavailable: requires a varying numerical series with unique, regularly spaced timestamps. No stationarity conclusion is reported."
    elif is_stat:
        interp = f"ADF rejects the unit-root null (statistic {adf_stat:.3f}, p = {adf_p:.4g}). This supports stationarity under this test's assumptions; it does not prove it."
    else:
        interp = f"ADF does not reject the unit-root null (statistic {adf_stat:.3f}, p = {adf_p:.4g}). Evidence is insufficient to conclude stationarity."

    # Lag autocorrelations
    series_s = pd.Series(metric_vals)
    lag_acs: list[dict[str, float | int]] = []
    for lag in [1, 2, 3, 5, 7]:
        if len(series_s) > lag + 5:
            ac_val = float(series_s.autocorr(lag=lag))
            if np.isfinite(ac_val):
                lag_acs.append({"lag": lag, "autocorrelation": round(ac_val, 4)})

    # Subsampled chart points (up to 80 points)
    step = max(1, int(np.ceil(len(clean) / 80)))
    chart_pts: list[dict[str, str | float]] = []
    for i in range(0, len(clean), step):
        row = clean.iloc[i]
        chart_pts.append(
            {
                "timestamp": str(row[dt_col])[:10],
                "value": round(float(row[metric_col]), 2),
            }
        )

    return TimeSeriesResult(
        datetime_column=dt_col,
        metric_column=metric_col,
        total_observations=len(clean),
        adf_statistic=round(adf_stat, 4) if adf_stat is not None else None,
        adf_p_value=adf_p,
        is_stationary=is_stat,
        critical_values=crit_vals,
        stationarity_interpretation=interp,
        lag_autocorrelations=lag_acs,
        chart_series=chart_pts,
        trend_summary=interp,
    )
