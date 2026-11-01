"""Data analysis utilities for Infera.

Provides functions to:
1. Safely read uploaded CSV data into a pandas DataFrame.
2. Compute dataset summary and descriptive statistics.
3. Compute Pearson correlations between numeric columns.
4. Generate a simple Markdown summary report.
"""

from __future__ import annotations

import io
from typing import Any

import numpy as np
import pandas as pd

# Upload constraints
MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024  # 20 MB
MAX_ROWS = 100_000
MAX_COLUMNS = 100


def read_csv(file_bytes: bytes, filename: str = "data.csv") -> pd.DataFrame:
    """Read CSV file bytes into a pandas DataFrame with safety checks."""
    if len(file_bytes) == 0:
        raise ValueError("The uploaded CSV file is empty.")

    if len(file_bytes) > MAX_FILE_SIZE_BYTES:
        raise ValueError(
            f"File exceeds maximum allowed size of {MAX_FILE_SIZE_BYTES // (1024 * 1024)} MB."
        )

    try:
        df = pd.read_csv(io.BytesIO(file_bytes))
    except Exception as exc:
        raise ValueError(f"Could not parse CSV file: {exc}") from exc

    if df.empty:
        raise ValueError("The parsed CSV file contains no data rows.")

    if len(df) > MAX_ROWS:
        raise ValueError(f"Dataset has {len(df):,} rows, exceeding maximum limit of {MAX_ROWS:,}.")

    if len(df.columns) > MAX_COLUMNS:
        raise ValueError(
            f"Dataset has {len(df.columns)} columns, exceeding maximum limit of {MAX_COLUMNS}."
        )

    # Clean whitespace from string column names
    df.columns = [str(col).strip() for col in df.columns]

    return df


def compute_summary(df: pd.DataFrame) -> dict[str, Any]:
    """Compute dataset overview, column metadata, and descriptive statistics."""
    columns_info: list[dict[str, Any]] = []
    numeric_cols: list[str] = []

    for col in df.columns:
        series = df[col]
        is_num = bool(pd.api.types.is_numeric_dtype(series))
        if is_num:
            numeric_cols.append(col)

        columns_info.append(
            {
                "name": col,
                "dtype": str(series.dtype),
                "missing_count": int(series.isna().sum()),
                "missing_pct": round(float(series.isna().mean() * 100), 2),
                "unique_count": int(series.nunique(dropna=True)),
                "is_numeric": is_num,
            }
        )

    # Descriptive statistics for numeric columns
    stats: dict[str, dict[str, float]] = {}
    for col in numeric_cols:
        series = df[col].dropna()
        if len(series) == 0:
            continue
        desc = series.describe()
        stats[col] = {
            "count": float(desc.get("count", 0)),
            "mean": round(float(desc.get("mean", 0.0)), 4),
            "std": round(float(desc.get("std", 0.0)), 4) if pd.notna(desc.get("std")) else 0.0,
            "min": round(float(desc.get("min", 0.0)), 4),
            "q25": round(float(desc.get("25%", 0.0)), 4),
            "median": round(float(desc.get("50%", 0.0)), 4),
            "q75": round(float(desc.get("75%", 0.0)), 4),
            "max": round(float(desc.get("max", 0.0)), 4),
        }

    # First 10 rows for table preview
    preview_rows = df.head(10).replace({np.nan: None}).to_dict(orient="records")

    return {
        "row_count": int(len(df)),
        "column_count": int(len(df.columns)),
        "total_missing": int(df.isna().sum().sum()),
        "columns": columns_info,
        "numeric_columns": numeric_cols,
        "statistics": stats,
        "preview": preview_rows,
    }


def compute_correlations(df: pd.DataFrame) -> dict[str, Any]:
    """Compute Pearson correlation matrix and sorted pairs for numeric columns."""
    numeric_cols = [
        col
        for col in df.columns
        if pd.api.types.is_numeric_dtype(df[col]) and df[col].nunique(dropna=True) > 1
    ]

    if len(numeric_cols) < 2:
        return {"pairs": [], "matrix": {"columns": [], "rows": []}}

    corr_df = df[numeric_cols].corr(method="pearson")

    # Extract distinct pairs
    pairs: list[dict[str, Any]] = []
    for i in range(len(numeric_cols)):
        for j in range(i + 1, len(numeric_cols)):
            col1 = numeric_cols[i]
            col2 = numeric_cols[j]
            val = corr_df.iloc[i, j]
            if pd.notna(val):
                pairs.append(
                    {
                        "col1": col1,
                        "col2": col2,
                        "correlation": round(float(val), 4),
                        "abs_correlation": round(abs(float(val)), 4),
                    }
                )

    pairs.sort(key=lambda p: p["abs_correlation"], reverse=True)

    # Format 2D matrix for heatmap
    matrix_rows: list[list[float]] = []
    for row in corr_df.to_numpy():
        matrix_rows.append([round(float(val), 4) if pd.notna(val) else 0.0 for val in row])

    return {
        "pairs": pairs,
        "matrix": {
            "columns": numeric_cols,
            "rows": matrix_rows,
        },
    }


def generate_markdown_report(
    filename: str,
    summary: dict[str, Any],
    correlations: dict[str, Any],
    regression: dict[str, Any] | None = None,
) -> str:
    """Generate a clean, readable Markdown analysis report."""
    lines: list[str] = [
        f"# Infera Analysis Report: {filename}",
        "",
        "## 1. Dataset Overview",
        f"- **File Name**: {filename}",
        f"- **Total Rows**: {summary['row_count']:,}",
        f"- **Total Columns**: {summary['column_count']}",
        f"- **Total Missing Cells**: {summary['total_missing']:,}",
        "",
        "### Column Schema",
        "| Column Name | Type | Missing Values | Missing % | Unique |",
        "| :--- | :--- | :--- | :--- | :--- |",
    ]

    for col in summary["columns"]:
        lines.append(
            f"| `{col['name']}` | `{col['dtype']}` | {col['missing_count']} | {col['missing_pct']}% | {col['unique_count']} |"
        )

    lines.extend(
        [
            "",
            "## 2. Descriptive Statistics (Numeric Columns)",
            "| Column | Mean | Std Dev | Min | Median | Max |",
            "| :--- | :--- | :--- | :--- | :--- | :--- |",
        ]
    )

    for col, stat in summary["statistics"].items():
        lines.append(
            f"| `{col}` | {stat['mean']} | {stat['std']} | {stat['min']} | {stat['median']} | {stat['max']} |"
        )

    lines.extend(
        [
            "",
            "## 3. Top Pearson Correlations",
        ]
    )

    pairs = correlations.get("pairs", [])
    if pairs:
        lines.extend(
            [
                "| Feature 1 | Feature 2 | Correlation |",
                "| :--- | :--- | :--- |",
            ]
        )
        for p in pairs[:10]:
            lines.append(f"| `{p['col1']}` | `{p['col2']}` | {p['correlation']} |")
    else:
        lines.append("_Not enough numeric columns with variance to compute correlations._")

    if regression:
        metrics = regression["metrics"]
        lines.extend(
            [
                "",
                "## 4. Linear Regression Results",
                f"- **Target Column**: `{regression['target_column']}`",
                f"- **Training Samples**: {regression['train_samples']:,}",
                f"- **Test Samples**: {regression['test_samples']:,}",
                f"- **Test R²**: {metrics['r2']}",
                f"- **Train R²**: {metrics['train_r2']}",
                f"- **Mean Absolute Error (MAE)**: {metrics['mae']}",
                f"- **Root Mean Squared Error (RMSE)**: {metrics['rmse']}",
                f"- **Intercept**: {regression['intercept']}",
                "",
                "### Feature Coefficients",
                "| Feature | Weight (Coefficient) |",
                "| :--- | :--- |",
            ]
        )
        for coef in regression["coefficients"]:
            lines.append(f"| `{coef['feature']}` | {coef['weight']} |")

    lines.extend(
        [
            "",
            "---",
            "_Generated by Infera · Beginner-Friendly Machine Learning Engine_",
        ]
    )

    return "\n".join(lines)
