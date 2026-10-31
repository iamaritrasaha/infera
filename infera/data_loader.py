"""Data loading, validation, and schema inspection.

This module reads uploaded datasets (primarily CSV files) into pandas DataFrames,
validates that the data is usable, and profiles columns and data quality.
"""

import io
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from infera.models import (
    CardinalityProfile,
    ColumnSummary,
    DataQuality,
    DuplicateProfile,
    MissingValueProfile,
    OutlierProfile,
    PotentialTarget,
)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
# 15 Megabytes maximum upload size to protect memory on learner laptops
MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024

# Minimum number of rows required for statistical significance
MIN_ROWS_FOR_ANALYSIS = 3

# High cardinality threshold for categorical columns (percentage of unique values)
HIGH_CARDINALITY_RATIO = 0.5


# ---------------------------------------------------------------------------
# Loading and Validation Functions
# ---------------------------------------------------------------------------


def load_csv(source: bytes | str | Path) -> pd.DataFrame:
    """Read a CSV file into a pandas DataFrame and perform sanity checks.

    Args:
        source: Raw file bytes or a file path to the CSV.

    Returns:
        A validated pandas DataFrame.

    Raises:
        ValueError: If the file is empty, malformed, or has no columns.
    """
    if isinstance(source, bytes):
        if len(source) == 0:
            raise ValueError("The uploaded file is completely empty.")
        if len(source) > MAX_FILE_SIZE_BYTES:
            raise ValueError(
                f"File size exceeds the limit of {MAX_FILE_SIZE_BYTES // (1024 * 1024)} MB."
            )
        buffer = io.BytesIO(source)
    else:
        path = Path(source)
        if not path.exists():
            raise ValueError(f"File not found: {path}")
        if path.stat().st_size == 0:
            raise ValueError("The file is empty.")
        buffer = path

    try:
        df = pd.read_csv(buffer)
    except Exception as err:
        raise ValueError(f"Could not parse CSV file: {err}") from err

    if df.empty or len(df.columns) == 0:
        raise ValueError("The dataset contains no data rows or columns.")

    if len(df) < MIN_ROWS_FOR_ANALYSIS:
        raise ValueError(
            f"Dataset has only {len(df)} rows. At least {MIN_ROWS_FOR_ANALYSIS} rows are required for analysis."
        )

    # Standardize column names by stripping extra whitespace
    df.columns = [str(col).strip() for col in df.columns]

    return df


# ---------------------------------------------------------------------------
# Schema and Type Inference
# ---------------------------------------------------------------------------


def infer_column_type(series: pd.Series) -> str:
    """Determine the semantic type of a pandas Series.

    Returns one of: "numerical", "datetime", "boolean", "categorical", or "text".
    """
    # Check for boolean
    if pd.api.types.is_bool_dtype(series):
        return "boolean"

    # Check for numerical (integers, floats)
    if pd.api.types.is_numeric_dtype(series):
        return "numerical"

    # Check for datetime
    if pd.api.types.is_datetime64_any_dtype(series):
        return "datetime"

    # For object/string columns, test if it represents dates
    non_nulls = series.dropna()
    if len(non_nulls) > 0:
        # Check if values look like dates (e.g. 2024-01-01)
        first_few = non_nulls.head(5).astype(str)
        if first_few.str.match(r"^\d{4}[-/]\d{2}[-/]\d{2}").all():
            return "datetime"

    # Distinguish categorical (few unique values) from free-form text
    unique_count = series.nunique()
    total_count = len(non_nulls)

    if total_count > 0 and (
        unique_count / total_count <= HIGH_CARDINALITY_RATIO or unique_count <= 20
    ):
        return "categorical"

    return "text"


def inspect_columns(df: pd.DataFrame) -> list[ColumnSummary]:
    """Inspect every column in the DataFrame and gather descriptive metadata."""
    summaries: list[ColumnSummary] = []
    total_rows = len(df)

    for col_name in df.columns:
        series = df[col_name]
        null_count = int(series.isna().sum())
        null_percentage = (
            round((null_count / total_rows) * 100.0, 2) if total_rows > 0 else 0.0
        )
        unique_count = int(series.nunique())
        inferred = infer_column_type(series)

        # Collect up to 3 non-null sample values for quick preview
        sample_values: list[Any] = []
        for val in series.dropna().head(3):
            if isinstance(val, (np.integer, np.floating)):
                sample_values.append(val.item())
            else:
                sample_values.append(str(val))

        summaries.append(
            ColumnSummary(
                name=col_name,
                dtype=str(series.dtype),
                original_dtype=str(series.dtype),
                inferred_type=inferred,
                null_count=null_count,
                null_percentage=null_percentage,
                unique_count=unique_count,
                sample_values=sample_values,
            )
        )

    return summaries


def detect_potential_targets(df: pd.DataFrame) -> list[PotentialTarget]:
    """Identify columns that could serve as prediction targets for machine learning.

    We look for columns with names matching common target keywords, or numeric
    columns with healthy variance that aren't identifiers.
    """
    candidates: list[PotentialTarget] = []
    common_target_keywords = [
        "target",
        "label",
        "price",
        "churn",
        "salary",
        "score",
        "revenue",
        "cost",
        "sales",
        "status",
    ]

    for col in df.columns:
        col_lower = col.lower()
        series = df[col]

        # Skip columns that appear to be row identifiers or have only 1 value
        if (
            col_lower in ["id", "index", "row_id", "uuid", "guid"]
            or series.nunique() <= 1
        ):
            continue

        is_keyword_match = any(
            keyword in col_lower for keyword in common_target_keywords
        )

        if pd.api.types.is_numeric_dtype(series):
            # Numeric column: candidate for regression (or binary classification if only 0 and 1)
            if series.nunique() == 2:
                candidates.append(
                    PotentialTarget(column=col, suggested_type="binary_classification")
                )
            elif is_keyword_match or series.nunique() > 10:
                candidates.append(
                    PotentialTarget(column=col, suggested_type="regression")
                )
        elif series.nunique() <= 10 and is_keyword_match:
            # Low cardinality text/category: candidate for classification
            suggested = (
                "binary_classification"
                if series.nunique() == 2
                else "multiclass_classification"
            )
            candidates.append(PotentialTarget(column=col, suggested_type=suggested))

    return candidates


# ---------------------------------------------------------------------------
# Data Quality & Health Score
# ---------------------------------------------------------------------------


def calculate_health_score(df: pd.DataFrame) -> int:
    """Calculate an overall dataset health score from 0 to 100.

    100 represents a clean dataset with zero missing cells and zero duplicate rows.
    Points are subtracted for missing values and duplicate records.
    """
    total_cells = df.size
    if total_cells == 0:
        return 0

    missing_cells = int(df.isna().sum().sum())
    missing_ratio = missing_cells / total_cells

    duplicate_rows = int(df.duplicated().sum())
    duplicate_ratio = duplicate_rows / len(df) if len(df) > 0 else 0

    # Start at 100, penalize up to 50 points for missing data, up to 30 for duplicates
    score = 100.0 - (missing_ratio * 50.0) - (duplicate_ratio * 30.0)
    return max(0, min(100, int(round(score))))


def compute_quality_profile(df: pd.DataFrame) -> DataQuality:
    """Generate detailed audits of missing values, duplicates, outliers, and cardinality."""
    total_rows = len(df)
    total_cells = df.size
    total_missing_cells = int(df.isna().sum().sum())
    overall_missing_pct = (
        round((total_missing_cells / total_cells) * 100.0, 2)
        if total_cells > 0
        else 0.0
    )

    complete_rows = int((~df.isna().any(axis=1)).sum())
    rows_with_missing = total_rows - complete_rows

    # Missing profile per column
    col_missing_profiles = []
    cols_with_missing = 0
    for col in df.columns:
        m_count = int(df[col].isna().sum())
        if m_count > 0:
            cols_with_missing += 1
        m_pct = round((m_count / total_rows) * 100.0, 2) if total_rows > 0 else 0.0
        status = (
            "clean"
            if m_count == 0
            else (
                "minor" if m_pct < 5.0 else ("moderate" if m_pct < 20.0 else "severe")
            )
        )
        col_missing_profiles.append(
            {
                "column": col,
                "missing_count": m_count,
                "missing_percentage": m_pct,
                "status": status,
            }
        )

    missing_rec = (
        "Dataset is complete with no missing values."
        if total_missing_cells == 0
        else f"Consider imputing or dropping {total_missing_cells} missing values before deep modeling."
    )

    missing_profile = MissingValueProfile(
        total_cells=total_cells,
        total_missing_cells=total_missing_cells,
        overall_missing_percentage=overall_missing_pct,
        total_rows=total_rows,
        complete_rows_count=complete_rows,
        complete_rows_percentage=round((complete_rows / total_rows) * 100.0, 2)
        if total_rows > 0
        else 0.0,
        rows_with_missing_count=rows_with_missing,
        rows_with_missing_percentage=round((rows_with_missing / total_rows) * 100.0, 2)
        if total_rows > 0
        else 0.0,
        columns_with_missing_count=cols_with_missing,
        column_profiles=col_missing_profiles,
        recommendation=missing_rec,
    )

    # Duplicates profile
    duplicate_count = int(df.duplicated().sum())
    duplicate_pct = (
        round((duplicate_count / total_rows) * 100.0, 2) if total_rows > 0 else 0.0
    )
    dup_status = (
        "clean"
        if duplicate_count == 0
        else ("moderate" if duplicate_pct < 5.0 else "severe")
    )
    dup_rec = (
        "No duplicate rows detected."
        if duplicate_count == 0
        else f"Remove {duplicate_count} duplicate rows to avoid data bias."
    )

    # Check for ID column collisions
    has_id_collision = False
    id_col = None
    for col in df.columns:
        if col.lower() in ["id", "index", "row_id"]:
            id_col = col
            has_id_collision = df[col].duplicated().any()
            break

    dup_profile = DuplicateProfile(
        total_rows=total_rows,
        duplicate_rows_count=duplicate_count,
        duplicate_rows_percentage=duplicate_pct,
        unique_rows_count=total_rows - duplicate_count,
        status=dup_status,
        has_key_column_collisions=has_id_collision,
        key_column_name=id_col,
        key_collision_count=int(df[id_col].duplicated().sum())
        if id_col and has_id_collision
        else 0,
        recommendation=dup_rec,
    )

    # Outliers profile (using standard IQR: values < Q1 - 1.5*IQR or > Q3 + 1.5*IQR)
    numeric_cols = [c for c in df.columns if pd.api.types.is_numeric_dtype(df[c])]
    outlier_profiles = []
    total_outliers = 0
    cols_with_outliers = 0

    for col in numeric_cols:
        series = df[col].dropna()
        if len(series) < 4:
            continue
        q25 = float(series.quantile(0.25))
        q75 = float(series.quantile(0.75))
        iqr = q75 - q25
        lower_bound = q25 - (1.5 * iqr)
        upper_bound = q75 + (1.5 * iqr)

        outlier_mask = (series < lower_bound) | (series > upper_bound)
        outlier_count = int(outlier_mask.sum())
        outlier_pct = round((outlier_count / len(series)) * 100.0, 2)

        if outlier_count > 0:
            cols_with_outliers += 1
            total_outliers += outlier_count

        severity = (
            "none"
            if outlier_count == 0
            else (
                "mild"
                if outlier_pct < 5.0
                else ("notable" if outlier_pct < 15.0 else "extreme")
            )
        )

        outlier_profiles.append(
            {
                "column": col,
                "total_valid_count": len(series),
                "iqr_outlier_count": outlier_count,
                "iqr_outlier_percentage": outlier_pct,
                "iqr_lower_bound": round(lower_bound, 4),
                "iqr_upper_bound": round(upper_bound, 4),
                "zscore_outlier_count": outlier_count,
                "zscore_outlier_percentage": outlier_pct,
                "severity": severity,
                "context_note": f"Found {outlier_count} values outside the [{round(lower_bound, 2)}, {round(upper_bound, 2)}] IQR fence.",
            }
        )

    outlier_rec = (
        "No significant outliers detected."
        if total_outliers == 0
        else f"Found {total_outliers} mathematical outliers across {cols_with_outliers} columns. Verify if these are valid extreme values."
    )

    outlier_profile = OutlierProfile(
        total_numerical_columns_analyzed=len(numeric_cols),
        columns_with_outliers_count=cols_with_outliers,
        total_iqr_outliers=total_outliers,
        recommendation=outlier_rec,
        profiles=outlier_profiles,
    )

    # Cardinality profile
    constant_cols = [c for c in df.columns if df[c].nunique() <= 1]
    quasi_cols = [
        c
        for c in df.columns
        if df[c].nunique() == 2 and (df[c].value_counts().iloc[0] / len(df)) > 0.98
    ]
    cat_cols = [c for c in df.columns if not pd.api.types.is_numeric_dtype(df[c])]
    high_card_cols = [
        c for c in cat_cols if df[c].nunique() > 50 and df[c].nunique() / len(df) > 0.5
    ]

    cardinality_profile = CardinalityProfile(
        constant_columns=constant_cols,
        quasi_constant_columns=quasi_cols,
        high_cardinality_categorical_columns=high_card_cols,
        recommendation="Cardinality distributions are normal."
        if not constant_cols and not high_card_cols
        else "Consider dropping constant columns as they provide no variance.",
    )

    return DataQuality(
        missing=missing_profile,
        duplicates=dup_profile,
        outliers=outlier_profile,
        cardinality=cardinality_profile,
    )


def format_memory_size(bytes_count: int) -> str:
    """Format a byte count into a readable string (e.g. 1.25 MB)."""
    if bytes_count < 1024:
        return f"{bytes_count} B"
    if bytes_count < 1024 * 1024:
        return f"{bytes_count / 1024:.1f} KB"
    return f"{bytes_count / (1024 * 1024):.2f} MB"


def get_dataset_schema(df: pd.DataFrame) -> dict[str, Any]:
    """Compile structured schema metadata for a DataFrame."""
    columns_info = inspect_columns(df)
    memory_bytes = int(df.memory_usage(deep=True).sum())

    numerical_cols = [c.name for c in columns_info if c.inferred_type == "numerical"]
    categorical_cols = [
        c.name for c in columns_info if c.inferred_type == "categorical"
    ]
    datetime_cols = [c.name for c in columns_info if c.inferred_type == "datetime"]
    text_cols = [c.name for c in columns_info if c.inferred_type == "text"]
    constant_cols = [c.name for c in columns_info if c.unique_count <= 1]
    id_cols = [
        c.name
        for c in columns_info
        if c.name.lower() in ["id", "index", "row_id", "uuid"]
    ]
    high_card_cols = [
        c.name
        for c in columns_info
        if c.inferred_type == "categorical" and c.unique_count > 50
    ]

    potential_targets = detect_potential_targets(df)

    return {
        "row_count": len(df),
        "column_count": len(df.columns),
        "memory_formatted": format_memory_size(memory_bytes),
        "columns": [c.model_dump() for c in columns_info],
        "numerical_columns": numerical_cols,
        "categorical_columns": categorical_cols,
        "datetime_columns": datetime_cols,
        "text_columns": text_cols,
        "constant_columns": constant_cols,
        "high_cardinality_columns": high_card_cols,
        "id_columns": id_cols,
        "potential_targets": [t.model_dump() for t in potential_targets],
    }
