"""Tests for infera.statistics.

These tests use small, known numerical and categorical datasets to verify:
1. Mean, median, min, max, quartiles, and IQR calculations.
2. Missing value handling in descriptive statistics.
3. Categorical mode and frequency counting.
4. Histogram bin creation.
"""

import pandas as pd

from infera.statistics import (
    calculate_categorical_column_stats,
    calculate_numerical_column_stats,
    compute_descriptive_statistics,
)


def test_numerical_stats_with_known_values():
    """Verify statistical formulas against known hand-calculated values.

    Data: [10, 20, 30, 40, 50]
    Expected:
    - Count: 5
    - Mean: (10 + 20 + 30 + 40 + 50) / 5 = 30.0
    - Median: 30.0
    - Min: 10.0, Max: 50.0
    - 25th percentile (Q1): 20.0
    - 75th percentile (Q3): 40.0
    - IQR: 40.0 - 20.0 = 20.0
    """
    series = pd.Series([10.0, 20.0, 30.0, 40.0, 50.0])
    stats = calculate_numerical_column_stats(series, "test_col")

    assert stats.column == "test_col"
    assert stats.count == 5
    assert stats.null_count == 0
    assert stats.mean == 30.0
    assert stats.median == 30.0
    assert stats.min == 10.0
    assert stats.max == 50.0
    assert stats.q25 == 20.0
    assert stats.q75 == 40.0
    assert stats.iqr == 20.0
    assert len(stats.histogram) == 10


def test_numerical_stats_handles_missing_values():
    """Missing (NaN) values should be counted but excluded from numerical calculations."""
    series = pd.Series([10.0, None, 30.0, None, 50.0])
    stats = calculate_numerical_column_stats(series, "with_nulls")

    assert stats.count == 3
    assert stats.null_count == 2
    assert stats.mean == 30.0
    assert stats.min == 10.0
    assert stats.max == 50.0


def test_categorical_stats_with_known_frequencies():
    """Verify mode and category percentages.

    Data: ["apple", "banana", "apple", "cherry", "apple"]
    - Total: 5
    - Unique: 3
    - Mode: "apple" (frequency 3, percentage 60.0%)
    """
    series = pd.Series(["apple", "banana", "apple", "cherry", "apple"])
    stats = calculate_categorical_column_stats(series, "fruit")

    assert stats.column == "fruit"
    assert stats.total_count == 5
    assert stats.unique_count == 3
    assert stats.mode == "apple"
    assert stats.mode_frequency == 3
    assert stats.mode_percentage == 60.0
    assert len(stats.frequencies) == 3

    # Check that highest frequency category comes first
    assert stats.frequencies[0].category == "apple"
    assert stats.frequencies[0].count == 3


def test_compute_descriptive_statistics_dataframe():
    """Verify that summarizing a DataFrame computes both numerical and categorical stats."""
    df = pd.DataFrame(
        {
            "temperature": [72.0, 68.5, 75.0, 71.2],
            "condition": ["sunny", "cloudy", "sunny", "rainy"],
        }
    )
    summary = compute_descriptive_statistics(df)

    assert len(summary.numerical) == 1
    assert summary.numerical[0].column == "temperature"
    assert summary.numerical[0].mean > 70.0

    assert len(summary.categorical) == 1
    assert summary.categorical[0].column == "condition"
    assert summary.categorical[0].mode == "sunny"
