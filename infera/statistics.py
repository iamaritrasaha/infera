"""Descriptive statistics calculation.

This module computes standard statistical metrics for numerical and categorical columns
using pandas, NumPy, and SciPy. Every formula and calculation is straightforward,
avoiding unnecessary abstractions.
"""

import numpy as np
import pandas as pd
from scipy import stats as sp_stats

from infera.models import (
    CategoricalColumnStats,
    CategoryFrequency,
    DescriptiveStatistics,
    HistogramBin,
    NumericalColumnStats,
)

# Number of equal-width bins to use when drawing numerical histograms
DEFAULT_HISTOGRAM_BINS = 10


def calculate_numerical_column_stats(
    series: pd.Series, column_name: str
) -> NumericalColumnStats:
    """Calculate descriptive statistics and histogram bins for one numerical column.

    Mathematical steps:
    1. Filter out missing (NaN) values to compute valid statistics.
    2. Compute central tendency: mean (average) and median (50th percentile).
    3. Compute dispersion: standard deviation, variance, and IQR (Q3 - Q1).
    4. Compute shape: skewness (asymmetry) and kurtosis (tail heaviness).
    5. Discretize into 10 histogram bins for distribution visualization.
    """
    total_count = len(series)
    clean_series = series.dropna().astype(float)
    null_count = total_count - len(clean_series)

    if len(clean_series) == 0:
        # Graceful fallback when the column has 100% missing values
        return NumericalColumnStats(
            column=column_name,
            count=0,
            null_count=null_count,
            mean=None,
            median=None,
            std=None,
            variance=None,
            min=0.0,
            max=0.0,
            q25=0.0,
            q75=0.0,
            iqr=0.0,
            skewness=None,
            skewness_interpretation="No non-null data available",
            kurtosis=None,
            kurtosis_interpretation="No non-null data available",
            histogram=[],
        )

    mean_val = float(clean_series.mean())
    median_val = float(clean_series.median())
    std_val = float(clean_series.std()) if len(clean_series) > 1 else 0.0
    var_val = float(clean_series.var()) if len(clean_series) > 1 else 0.0
    min_val = float(clean_series.min())
    max_val = float(clean_series.max())

    q25 = float(clean_series.quantile(0.25))
    q75 = float(clean_series.quantile(0.75))
    iqr = q75 - q25

    # Skewness measures whether the data distribution leans left or right
    # skew > 0.5: right-skewed (long tail of large values)
    # skew < -0.5: left-skewed (long tail of small values)
    skew_val: float | None = None
    skew_interp = "Symmetric"
    if len(clean_series) >= 3 and std_val > 0:
        try:
            skew_val = float(sp_stats.skew(clean_series))
            if skew_val > 0.5:
                skew_interp = "Right-skewed (tail points right towards higher values)"
            elif skew_val < -0.5:
                skew_interp = "Left-skewed (tail points left towards lower values)"
            else:
                skew_interp = "Approximately symmetric"
        except Exception:
            skew_val = None

    # Kurtosis measures whether the data has heavy tails and outliers
    # kurtosis > 1: heavy-tailed (leptokurtic, more extreme outliers than normal)
    # kurtosis < -1: light-tailed (platykurtic, fewer outliers)
    kurt_val: float | None = None
    kurt_interp = "Normal tails"
    if len(clean_series) >= 4 and std_val > 0:
        try:
            kurt_val = float(sp_stats.kurtosis(clean_series))
            if kurt_val > 1.0:
                kurt_interp = "Heavy-tailed (prone to extreme outliers)"
            elif kurt_val < -1.0:
                kurt_interp = "Light-tailed (few outliers)"
            else:
                kurt_interp = "Normal tail weight (mesokurtic)"
        except Exception:
            kurt_val = None

    # Compute histogram buckets using numpy.histogram
    histogram_bins: list[HistogramBin] = []
    if min_val < max_val:
        counts, bin_edges = np.histogram(clean_series, bins=DEFAULT_HISTOGRAM_BINS)
        for i in range(len(counts)):
            start = float(bin_edges[i])
            end = float(bin_edges[i + 1])
            histogram_bins.append(
                HistogramBin(
                    bin_start=round(start, 2),
                    bin_end=round(end, 2),
                    count=int(counts[i]),
                    label=f"{start:.1f} - {end:.1f}",
                )
            )
    else:
        # All values are identical
        histogram_bins.append(
            HistogramBin(
                bin_start=min_val,
                bin_end=max_val,
                count=len(clean_series),
                label=f"{min_val:.1f}",
            )
        )

    return NumericalColumnStats(
        column=column_name,
        count=len(clean_series),
        null_count=null_count,
        mean=round(mean_val, 4),
        median=round(median_val, 4),
        std=round(std_val, 4),
        variance=round(var_val, 4),
        min=round(min_val, 4),
        max=round(max_val, 4),
        q25=round(q25, 4),
        q75=round(q75, 4),
        iqr=round(iqr, 4),
        skewness=round(skew_val, 4) if skew_val is not None else None,
        skewness_interpretation=skew_interp,
        kurtosis=round(kurt_val, 4) if kurt_val is not None else None,
        kurtosis_interpretation=kurt_interp,
        histogram=histogram_bins,
    )


def calculate_categorical_column_stats(
    series: pd.Series, column_name: str
) -> CategoricalColumnStats:
    """Calculate frequency distributions for one categorical or text column."""
    total_count = len(series)
    clean_series = series.dropna().astype(str)
    null_count = total_count - len(clean_series)
    unique_count = int(clean_series.nunique())

    if len(clean_series) == 0:
        return CategoricalColumnStats(
            column=column_name,
            total_count=total_count,
            null_count=null_count,
            unique_count=0,
            mode="",
            mode_frequency=0,
            mode_percentage=0.0,
            is_imbalanced=False,
            frequencies=[],
        )

    counts = clean_series.value_counts()
    mode_val = str(counts.index[0])
    mode_freq = int(counts.iloc[0])
    mode_pct = round((mode_freq / len(clean_series)) * 100.0, 2)

    # A category is flagged as imbalanced if the top category makes up over 70% of rows
    is_imbalanced = mode_pct > 70.0 and unique_count > 1

    # Keep top 10 categories to avoid overwhelming the user
    frequencies: list[CategoryFrequency] = []
    for cat_name, cat_count in counts.head(10).items():
        frequencies.append(
            CategoryFrequency(
                category=str(cat_name),
                count=int(cat_count),
                percentage=round((int(cat_count) / len(clean_series)) * 100.0, 2),
            )
        )

    return CategoricalColumnStats(
        column=column_name,
        total_count=total_count,
        null_count=null_count,
        unique_count=unique_count,
        mode=mode_val,
        mode_frequency=mode_freq,
        mode_percentage=mode_pct,
        is_imbalanced=is_imbalanced,
        frequencies=frequencies,
    )


def compute_descriptive_statistics(
    df: pd.DataFrame,
    numerical_columns: list[str] | None = None,
    categorical_columns: list[str] | None = None,
) -> DescriptiveStatistics:
    """Compute complete descriptive statistics across all columns in the DataFrame."""
    if numerical_columns is None:
        numerical_columns = [
            c for c in df.columns if pd.api.types.is_numeric_dtype(df[c])
        ]

    if categorical_columns is None:
        categorical_columns = [c for c in df.columns if c not in numerical_columns]

    num_stats = [
        calculate_numerical_column_stats(df[col], col) for col in numerical_columns
    ]

    cat_stats = [
        calculate_categorical_column_stats(df[col], col) for col in categorical_columns
    ]

    return DescriptiveStatistics(numerical=num_stats, categorical=cat_stats)
