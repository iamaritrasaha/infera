"""Comprehensive descriptive statistics calculation."""

from dataclasses import dataclass

import pandas as pd

from app.analysis.profiler.distributions import (
    CategoricalDistribution,
    NumericalDistribution,
    analyze_categorical_distribution,
    analyze_numerical_distribution,
)


@dataclass
class DescriptiveStats:
    """Consolidated descriptive statistics for all columns."""

    numerical: list[NumericalDistribution]
    categorical: list[CategoricalDistribution]


def compute_descriptive_statistics(
    df: pd.DataFrame,
    numerical_cols: list[str],
    categorical_cols: list[str],
) -> DescriptiveStats:
    """Computes descriptive statistics for both numerical and categorical columns."""
    num_list: list[NumericalDistribution] = []
    cat_list: list[CategoricalDistribution] = []

    for col in numerical_cols:
        if col in df.columns:
            dist = analyze_numerical_distribution(df[col])
            if dist:
                num_list.append(dist)

    for col in categorical_cols:
        if col in df.columns:
            dist = analyze_categorical_distribution(df[col])
            if dist:
                cat_list.append(dist)

    return DescriptiveStats(numerical=num_list, categorical=cat_list)
