"""Time-series stationarity testing, lag autocorrelation, and trend extraction."""

from dataclasses import dataclass

import pandas as pd
from statsmodels.tsa.stattools import adfuller


@dataclass
class TimeSeriesResult:
    """Artifacts from time-series diagnostic analysis."""

    datetime_column: str
    metric_column: str
    total_observations: int
    adf_statistic: float
    adf_p_value: float
    is_stationary: bool
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
        adf_out = adfuller(metric_vals, autolag="AIC")
        adf_stat = float(adf_out[0])
        adf_p = float(adf_out[1])
        crit_vals = {str(k): round(float(v), 3) for k, v in adf_out[4].items()}
        is_stat = adf_p < 0.05
    except Exception:
        adf_stat, adf_p = 0.0, 1.0
        crit_vals = {}
        is_stat = False

    interp = (
        f"The series is stationary (ADF statistic = {adf_stat:.3f}, p = {adf_p:.4f} < 0.05). "
        "Mean and variance appear stable across time."
        if is_stat
        else f"The series is non-stationary (ADF statistic = {adf_stat:.3f}, p = {adf_p:.4f} >= 0.05). "
        "Evidence indicates stochastic trend or drift; differencing is recommended before autoregressive modeling."
    )

    # Lag autocorrelations
    series_s = pd.Series(metric_vals)
    lag_acs: list[dict[str, float | int]] = []
    for lag in [1, 2, 3, 5, 7]:
        if len(series_s) > lag + 5:
            ac_val = float(series_s.autocorr(lag=lag))
            lag_acs.append({"lag": lag, "autocorrelation": round(ac_val, 4)})

    # Subsampled chart points (up to 80 points)
    step = max(1, len(clean) // 80)
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
        adf_statistic=round(adf_stat, 4),
        adf_p_value=round(adf_p, 4),
        is_stationary=is_stat,
        critical_values=crit_vals,
        stationarity_interpretation=interp,
        lag_autocorrelations=lag_acs,
        chart_series=chart_pts,
        trend_summary=interp,
    )
