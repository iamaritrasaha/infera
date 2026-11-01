"""Tests for infera.analysis and infera.ml modules."""

import numpy as np
import pandas as pd
import pytest

from infera.analysis import (
    compute_correlations,
    compute_summary,
    generate_markdown_report,
    read_csv,
)
from infera.ml import train_linear_regression


def test_read_csv_valid():
    csv_bytes = b"feature_a, feature_b ,target\n1,2,3\n4,5,6\n7,8,9\n"
    df = read_csv(csv_bytes)
    assert len(df) == 3
    assert list(df.columns) == ["feature_a", "feature_b", "target"]
    assert df["feature_a"].tolist() == [1, 4, 7]


def test_read_csv_empty():
    with pytest.raises(ValueError, match="empty"):
        read_csv(b"")


def test_compute_summary():
    df = pd.DataFrame(
        {
            "num": [10.0, 20.0, 30.0, np.nan],
            "cat": ["a", "b", "a", "b"],
        }
    )
    summary = compute_summary(df)
    assert summary["row_count"] == 4
    assert summary["column_count"] == 2
    assert summary["total_missing"] == 1
    assert "num" in summary["statistics"]
    assert summary["statistics"]["num"]["mean"] == 20.0
    assert summary["statistics"]["num"]["min"] == 10.0
    assert summary["statistics"]["num"]["max"] == 30.0
    assert len(summary["preview"]) == 4


def test_compute_correlations():
    # Perfectly correlated columns: y = 2*x
    x = np.array([1, 2, 3, 4, 5], dtype=float)
    y = 2.0 * x
    df = pd.DataFrame({"x": x, "y": y, "cat": ["a", "b", "c", "d", "e"]})
    res = compute_correlations(df)

    assert len(res["pairs"]) == 1
    pair = res["pairs"][0]
    assert set([pair["col1"], pair["col2"]]) == {"x", "y"}
    assert pair["correlation"] == 1.0
    assert len(res["matrix"]["columns"]) == 2


def test_compute_correlations_insufficient_numeric():
    df = pd.DataFrame({"cat1": ["a", "b"], "cat2": ["c", "d"]})
    res = compute_correlations(df)
    assert res["pairs"] == []
    assert res["matrix"]["columns"] == []


def test_train_linear_regression_success():
    np.random.seed(42)
    n = 100
    x1 = np.linspace(1, 10, n)
    x2 = np.random.normal(5, 1, n)
    # y = 3 * x1 + 2 * x2 + 5
    y = 3.0 * x1 + 2.0 * x2 + 5.0 + np.random.normal(0, 0.2, n)

    df = pd.DataFrame({"feature1": x1, "feature2": x2, "target": y})

    result = train_linear_regression(df, target_column="target")

    assert result["target_column"] == "target"
    assert result["train_samples"] == 80
    assert result["test_samples"] == 20
    assert result["metrics"]["r2"] > 0.95
    assert result["metrics"]["mae"] < 1.0
    assert len(result["coefficients"]) == 2
    assert len(result["chart_points"]) == 20


def test_train_linear_regression_imputation():
    # Verify missing feature values are imputed on train/test without data leakage
    n = 50
    x = np.linspace(1, 10, n)
    y = 2.0 * x + 1.0
    df = pd.DataFrame({"x": x, "y": y})
    df.loc[2, "x"] = np.nan  # Inject missing value

    result = train_linear_regression(df, target_column="y")
    assert result["metrics"]["r2"] > 0.8


def test_train_linear_regression_invalid_target():
    df = pd.DataFrame({"x": [1, 2, 3], "cat": ["a", "b", "c"]})
    with pytest.raises(ValueError, match="not numeric"):
        train_linear_regression(df, target_column="cat")


def test_train_linear_regression_insufficient_rows():
    df = pd.DataFrame({"x": [1, 2, 3], "y": [4, 5, 6]})
    with pytest.raises(ValueError, match="At least 10 rows"):
        train_linear_regression(df, target_column="y")


def test_generate_markdown_report():
    summary = {
        "row_count": 50,
        "column_count": 3,
        "total_missing": 0,
        "columns": [
            {
                "name": "x",
                "dtype": "float64",
                "missing_count": 0,
                "missing_pct": 0.0,
                "unique_count": 50,
            },
            {
                "name": "y",
                "dtype": "float64",
                "missing_count": 0,
                "missing_pct": 0.0,
                "unique_count": 50,
            },
        ],
        "statistics": {
            "x": {"mean": 5.0, "std": 1.0, "min": 1.0, "median": 5.0, "max": 9.0},
        },
    }
    correlations = {
        "pairs": [{"col1": "x", "col2": "y", "correlation": 0.95}],
    }
    regression = {
        "target_column": "y",
        "train_samples": 40,
        "test_samples": 10,
        "metrics": {"r2": 0.95, "train_r2": 0.96, "mae": 0.2, "rmse": 0.25},
        "intercept": 1.5,
        "coefficients": [{"feature": "x", "weight": 2.1}],
    }

    report = generate_markdown_report("test.csv", summary, correlations, regression)
    assert "# Infera Analysis Report: test.csv" in report
    assert "Linear Regression Results" in report
    assert "0.95" in report
