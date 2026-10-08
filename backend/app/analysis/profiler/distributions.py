"""Statistical distribution analysis for numerical and categorical variables."""

from dataclasses import dataclass

import numpy as np
import pandas as pd
from scipy import stats


@dataclass
class HistogramBin:
    """A histogram bin for interactive charting."""

    bin_start: float
    bin_end: float
    count: int
    label: str


@dataclass
class NumericalDistribution:
    """Detailed distribution metrics for a single numerical column."""

    column: str
    count: int
    null_count: int
    mean: float
    median: float
    std: float
    variance: float
    min: float
    max: float
    q25: float
    q75: float
    iqr: float
    skewness: float | None
    skewness_interpretation: str
    kurtosis: float | None
    kurtosis_interpretation: str
    histogram: list[HistogramBin]


@dataclass
class CategoryFrequency:
    """Frequency count for a single category level."""

    category: str
    count: int
    percentage: float


@dataclass
class CategoricalDistribution:
    """Frequency and cardinality profile for a categorical column."""

    column: str
    total_count: int
    null_count: int
    unique_count: int
    mode: str
    mode_frequency: int
    mode_percentage: float
    is_imbalanced: bool
    frequencies: list[CategoryFrequency]


def _interpret_skewness(val: float) -> str:
    """Plain-English interpretation of Fisher-Pearson skewness."""
    if np.isnan(val):
        return "Indeterminate"
    if abs(val) < 0.5:
        return "Approximately symmetric distribution"
    elif val >= 0.5 and val < 1.0:
        return "Moderately right-skewed (positive tail)"
    elif val >= 1.0:
        return "Substantially right-skewed (heavy positive tail)"
    elif val <= -0.5 and val > -1.0:
        return "Moderately left-skewed (negative tail)"
    else:
        return "Substantially left-skewed (heavy negative tail)"


def _interpret_kurtosis(val: float) -> str:
    """Plain-English interpretation of excess kurtosis."""
    if np.isnan(val):
        return "Indeterminate"
    if abs(val) < 0.5:
        return "Mesokurtic (normal-like tail behavior)"
    elif val >= 0.5:
        return "Leptokurtic (sharp peak, heavy outliers/fat tails)"
    else:
        return "Platykurtic (flat peak, thin tails, fewer outliers)"


def analyze_numerical_distribution(
    series: pd.Series, bins_count: int = 12
) -> NumericalDistribution | None:
    """Computes exact distribution parameters and histogram bins for a numeric series."""
    clean = pd.to_numeric(series.dropna(), errors="coerce").dropna()
    total = len(series)
    null_count = total - len(clean)

    if len(clean) == 0:
        return None

    count = len(clean)
    mean_val = float(clean.mean())
    median_val = float(clean.median())
    std_val = float(clean.std(ddof=1)) if count > 1 else float("nan")
    var_val = float(clean.var(ddof=1)) if count > 1 else float("nan")
    min_val = float(clean.min())
    max_val = float(clean.max())
    q25 = float(clean.quantile(0.25))
    q75 = float(clean.quantile(0.75))
    iqr = q75 - q25

    # Skewness and excess kurtosis using scipy
    skew_val = float(stats.skew(clean, bias=False)) if count >= 3 and std_val > 0 else float("nan")
    kurt_val = float(stats.kurtosis(clean, bias=False)) if count >= 4 and std_val > 0 else float("nan")

    # Build histogram bins
    bins_list: list[HistogramBin] = []
    if count >= 2 and min_val < max_val:
        counts, bin_edges = np.histogram(clean, bins=bins_count)
        for i in range(len(counts)):
            b_start = round(float(bin_edges[i]), 2)
            b_end = round(float(bin_edges[i + 1]), 2)
            bins_list.append(
                HistogramBin(
                    bin_start=b_start,
                    bin_end=b_end,
                    count=int(counts[i]),
                    label=f"{b_start:g} - {b_end:g}",
                )
            )
    else:
        bins_list.append(
            HistogramBin(
                bin_start=round(min_val, 2),
                bin_end=round(max_val, 2),
                count=count,
                label=f"{min_val:g}",
            )
        )

    return NumericalDistribution(
        column=str(series.name),
        count=count,
        null_count=null_count,
        mean=round(mean_val, 3),
        median=round(median_val, 3),
        std=round(std_val, 3),
        variance=round(var_val, 3),
        min=round(min_val, 3),
        max=round(max_val, 3),
        q25=round(q25, 3),
        q75=round(q75, 3),
        iqr=round(iqr, 3),
        skewness=round(skew_val, 3),
        skewness_interpretation=_interpret_skewness(skew_val),
        kurtosis=round(kurt_val, 3),
        kurtosis_interpretation=_interpret_kurtosis(kurt_val),
        histogram=bins_list,
    )


def analyze_categorical_distribution(
    series: pd.Series, top_k: int = 10
) -> CategoricalDistribution | None:
    """Computes category frequencies, mode, and imbalance signals."""
    total = len(series)
    clean = series.dropna().astype(str)
    null_count = total - len(clean)

    if len(clean) == 0:
        return None

    counts_series = clean.value_counts()
    unique_count = len(counts_series)

    mode_val = str(counts_series.index[0]) if unique_count > 0 else ""
    mode_freq = int(counts_series.iloc[0]) if unique_count > 0 else 0
    mode_pct = round((mode_freq / len(clean)) * 100.0, 2) if len(clean) > 0 else 0.0

    # Imbalance flag: if top category dominates >75% of non-null records (for >1 category)
    is_imbalanced = unique_count > 1 and mode_pct > 75.0

    frequencies: list[CategoryFrequency] = []
    for cat_name, freq in counts_series.head(top_k).items():
        pct = round((int(freq) / len(clean)) * 100.0, 2)
        frequencies.append(
            CategoryFrequency(
                category=str(cat_name),
                count=int(freq),
                percentage=pct,
            )
        )

    return CategoricalDistribution(
        column=str(series.name),
        total_count=total,
        null_count=null_count,
        unique_count=unique_count,
        mode=mode_val,
        mode_frequency=mode_freq,
        mode_percentage=mode_pct,
        is_imbalanced=is_imbalanced,
        frequencies=frequencies,
    )
