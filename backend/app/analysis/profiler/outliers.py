"""Outlier identification, boundary computation, and distinction from corrupt data."""

from dataclasses import dataclass

import numpy as np
import pandas as pd


@dataclass
class ColumnOutlierProfile:
    """Outlier metrics for a single numerical column."""

    column: str
    total_valid_count: int
    # IQR Method
    iqr_outlier_count: int
    iqr_outlier_percentage: float
    iqr_lower_bound: float
    iqr_upper_bound: float
    # Z-Score Method (|z| > 3)
    zscore_outlier_count: int
    zscore_outlier_percentage: float
    # Severity & classification
    severity: str  # "none", "mild", "notable", "extreme"
    context_note: str  # Statistical anomaly vs potential data corruption distinction


@dataclass
class OutlierProfile:
    """Aggregate outlier summary across all numerical features."""

    total_numerical_columns_analyzed: int
    columns_with_outliers_count: int
    total_iqr_outliers: int
    profiles: list[ColumnOutlierProfile]
    recommendation: str


def analyze_column_outliers(series: pd.Series) -> ColumnOutlierProfile | None:
    """Computes exact IQR fences and Z-score outlier counts for a numerical series."""
    clean = pd.to_numeric(series.dropna(), errors="coerce").dropna()
    n = len(clean)
    if n < 5:
        return None

    # IQR calculation
    q25 = float(clean.quantile(0.25))
    q75 = float(clean.quantile(0.75))
    iqr = q75 - q25
    iqr_lower = round(q25 - 1.5 * iqr, 3)
    iqr_upper = round(q75 + 1.5 * iqr, 3)

    iqr_mask = (clean < (q25 - 1.5 * iqr)) | (clean > (q75 + 1.5 * iqr))
    iqr_count = int(iqr_mask.sum())
    iqr_pct = round((iqr_count / n) * 100.0, 2)

    # Z-Score calculation
    mean_val = float(clean.mean())
    std_val = float(clean.std(ddof=1))
    if std_val > 0:
        z_scores = np.abs((clean - mean_val) / std_val)
        zscore_count = int((z_scores > 3.0).sum())
        zscore_pct = round((zscore_count / n) * 100.0, 2)
    else:
        zscore_count = 0
        zscore_pct = 0.0

    # Severity classification
    if iqr_pct == 0.0:
        severity = "none"
        context_note = "All observations fall within standard interquartile bounds."
    elif iqr_pct < 2.0:
        severity = "mild"
        context_note = (
            f"Detected {iqr_count} observations outside [ {iqr_lower}, {iqr_upper} ]. "
            "These are standard statistical extremes (natural tail variations), not necessarily bad data."
        )
    elif iqr_pct < 7.0:
        severity = "notable"
        context_note = f"{iqr_pct}% of values exceed 1.5x IQR fences. Robust scaling or tree-based algorithms are recommended."
    else:
        severity = "extreme"
        context_note = (
            f"High outlier frequency ({iqr_pct}%). Verify if extreme numbers represent measurement errors, "
            "default placeholder encodings (e.g. 9999), or genuine heavy-tailed phenomena."
        )

    return ColumnOutlierProfile(
        column=str(series.name),
        total_valid_count=n,
        iqr_outlier_count=iqr_count,
        iqr_outlier_percentage=iqr_pct,
        iqr_lower_bound=iqr_lower,
        iqr_upper_bound=iqr_upper,
        zscore_outlier_count=zscore_count,
        zscore_outlier_percentage=zscore_pct,
        severity=severity,
        context_note=context_note,
    )


def analyze_outliers(df: pd.DataFrame, numerical_cols: list[str]) -> OutlierProfile:
    """Assesses outliers across all numerical columns."""
    profiles: list[ColumnOutlierProfile] = []
    total_outliers = 0
    cols_with_outliers = 0

    for col in numerical_cols:
        if col in df.columns:
            p = analyze_column_outliers(df[col])
            if p:
                profiles.append(p)
                if p.iqr_outlier_count > 0:
                    cols_with_outliers += 1
                    total_outliers += p.iqr_outlier_count

    # Sort by percentage descending
    profiles.sort(key=lambda x: x.iqr_outlier_percentage, reverse=True)

    if cols_with_outliers == 0:
        recommendation = (
            "No substantial statistical outliers detected across analyzed numerical attributes."
        )
    elif total_outliers < 10:
        recommendation = "Minor tail variations are present. Inspect them in context; scaling does not correct measurement errors."
    else:
        recommendation = "Notable tail values are present. Review their meaning before choosing robust methods or clipping; unusual values may be valid observations."

    return OutlierProfile(
        total_numerical_columns_analyzed=len(profiles),
        columns_with_outliers_count=cols_with_outliers,
        total_iqr_outliers=total_outliers,
        profiles=profiles,
        recommendation=recommendation,
    )
