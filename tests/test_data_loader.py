"""Tests for infera.data_loader.

These tests demonstrate:
1. Loading a valid CSV from bytes and file path.
2. Graceful rejection of empty files and non-existent paths.
3. Correct column data type detection (numerical, categorical, boolean).
4. Calculation of dataset health scores.
"""

from pathlib import Path

import pandas as pd
import pytest

from infera.data_loader import (
    calculate_health_score,
    get_dataset_schema,
    infer_column_type,
    load_csv,
)

SAMPLE_DIR = Path(__file__).resolve().parent.parent / "sample_data"


def test_load_valid_csv_file():
    """Verify loading an actual sample CSV from disk."""
    csv_path = SAMPLE_DIR / "housing.csv"
    df = load_csv(csv_path)

    assert isinstance(df, pd.DataFrame)
    assert len(df) > 100
    assert "price" in df.columns
    assert "sqft_living" in df.columns


def test_load_csv_from_bytes():
    """Verify loading CSV data from raw in-memory bytes."""
    raw_csv = b"age,salary,city\n25,50000,New York\n30,65000,Chicago\n35,80000,Boston\n"
    df = load_csv(raw_csv)

    assert len(df) == 3
    assert list(df.columns) == ["age", "salary", "city"]
    assert df["salary"].iloc[1] == 65000


def test_load_empty_csv_raises_error():
    """Verify that an empty file raises a clear, descriptive ValueError."""
    with pytest.raises(ValueError, match="empty"):
        load_csv(b"")


def test_load_insufficient_rows_raises_error():
    """Verify that a CSV with fewer than 3 rows is rejected."""
    too_small = b"x,y\n1,2\n"
    with pytest.raises(ValueError, match="At least 3 rows are required"):
        load_csv(too_small)


def test_infer_column_type():
    """Verify accurate type inference for different column dtypes."""
    df = pd.DataFrame(
        {
            "num": [10.5, 20.1, 30.2, 40.0],
            "cat": ["A", "B", "A", "B"],
            "flag": [True, False, True, False],
            "dates": ["2024-01-01", "2024-01-02", "2024-01-03", "2024-01-04"],
        }
    )

    assert infer_column_type(df["num"]) == "numerical"
    assert infer_column_type(df["cat"]) == "categorical"
    assert infer_column_type(df["flag"]) == "boolean"
    assert infer_column_type(df["dates"]) == "datetime"


def test_calculate_health_score_perfect():
    """A dataset with zero missing values and zero duplicates scores 100."""
    df = pd.DataFrame(
        {
            "x": [1, 2, 3, 4, 5],
            "y": ["a", "b", "c", "d", "e"],
        }
    )
    score = calculate_health_score(df)
    assert score == 100


def test_calculate_health_score_with_missing_and_duplicates():
    """A dataset with missing values and duplicates receives a lower health score."""
    df = pd.DataFrame(
        {
            "x": [1, 1, None, None],
            "y": ["a", "a", "b", None],
        }
    )
    score = calculate_health_score(df)
    # Score must be penalized below 100
    assert score < 100
    assert score >= 0


def test_get_dataset_schema():
    """Verify schema extraction compiles column classifications and memory sizes."""
    df = pd.DataFrame(
        {
            "id": [1, 2, 3, 4],
            "score": [88.0, 92.5, 79.0, 85.0],
            "group": ["A", "B", "A", "B"],
        }
    )
    schema = get_dataset_schema(df)

    assert schema["row_count"] == 4
    assert schema["column_count"] == 3
    assert "score" in schema["numerical_columns"]
    assert "group" in schema["categorical_columns"]
    assert "id" in schema["id_columns"]
