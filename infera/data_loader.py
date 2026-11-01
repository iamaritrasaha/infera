"""Data loading, validation, and schema inspection.

This module reads uploaded datasets into pandas DataFrames, validates data sanity,
and profiles column types, missing values, duplicates, and outliers.
"""

import csv
import io
import json
import zipfile
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
# Constants & Limits
# ---------------------------------------------------------------------------
MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024  # 15 MB
MAX_ROWS = 5000
MAX_COLUMNS = 100
MIN_ROWS_FOR_ANALYSIS = 3
HIGH_CARDINALITY_RATIO = 0.5


# ---------------------------------------------------------------------------
# Loading and Validation Functions
# ---------------------------------------------------------------------------


def validate_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    """Validate DataFrame dimensions, column names, and numeric ranges."""
    if df.empty or len(df.columns) == 0:
        raise ValueError("The dataset contains no data rows or columns.")
    if len(df.columns) > MAX_COLUMNS:
        raise ValueError(f"At most {MAX_COLUMNS} columns are supported.")
    if len(df) > MAX_ROWS:
        raise ValueError(f"At most {MAX_ROWS} rows are supported.")
    if len(df) < MIN_ROWS_FOR_ANALYSIS:
        raise ValueError(
            f"Dataset has only {len(df)} rows. At least {MIN_ROWS_FOR_ANALYSIS} rows are required for analysis."
        )

    names = [str(col).strip() for col in df.columns]
    if any(not name or len(name) > 100 for name in names) or len(set(names)) != len(names):
        raise ValueError(
            "Column names must be nonempty, unique after trimming, and at most 100 characters."
        )
    df.columns = names

    numeric = df.select_dtypes(include="number")
    if not numeric.empty:
        vals = numeric.to_numpy(dtype=float)
        if np.isinf(vals).any():
            raise ValueError(
                "Infinite numeric values are not supported; use empty cells for missing data."
            )
        if numeric.abs().gt(1e50).any().any():
            raise ValueError("Numeric magnitudes above 1e50 are not supported.")
    return df


def load_csv(source: bytes | str | Path) -> pd.DataFrame:
    """Read a CSV file into a validated pandas DataFrame."""
    if isinstance(source, bytes):
        raw = source
    else:
        path = Path(source)
        if not path.exists():
            raise ValueError(f"File not found: {path}")
        raw = path.read_bytes()

    if len(raw) == 0:
        raise ValueError(
            "The file is empty."
            if not isinstance(source, bytes)
            else "The uploaded file is completely empty."
        )
    if len(raw) > MAX_FILE_SIZE_BYTES:
        raise ValueError(
            f"File size exceeds the limit of {MAX_FILE_SIZE_BYTES // (1024 * 1024)} MB."
            if isinstance(source, bytes)
            else "File exceeds the 15 MB limit."
        )

    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError as err:
        raise ValueError(f"Could not parse CSV file: {err}") from err

    if "\x00" in text:
        raise ValueError("CSV contains binary NUL characters.")

    # Validate row width consistency and row limits
    try:
        records = csv.reader(io.StringIO(text), strict=True)
        header = next(records)
        names = [n.strip() for n in header]
        if any(not n or len(n) > 100 for n in names) or len(set(names)) != len(names):
            raise ValueError(
                "Column names must be nonempty, unique after trimming, and at most 100 characters."
            )
        if len(header) > MAX_COLUMNS:
            raise ValueError(f"At most {MAX_COLUMNS} columns are supported.")

        row_count = 0
        for row in records:
            if not row:
                continue
            if len(row) != len(header):
                raise ValueError("Every CSV row must have the same number of fields as the header.")
            row_count += 1
            if row_count > MAX_ROWS:
                raise ValueError(f"At most {MAX_ROWS} rows are supported.")

        df = pd.read_csv(io.StringIO(text))
    except Exception as err:
        raise ValueError(f"Could not parse CSV file: {err}") from err

    return validate_dataframe(df)


def load_dataset(content: bytes, filename: str) -> pd.DataFrame:
    """Read CSV, XLSX, JSON, or Parquet datasets with bounded safety checks."""
    suffix = Path(filename).suffix.lower()
    if suffix == ".csv":
        return load_csv(content)

    if len(content) > MAX_FILE_SIZE_BYTES:
        raise ValueError("File exceeds the 15 MB limit.")

    try:
        if suffix == ".xlsx":
            with zipfile.ZipFile(io.BytesIO(content)) as archive:
                if sum(item.file_size for item in archive.infolist()) > 50 * 1024 * 1024:
                    raise ValueError("Expanded workbook exceeds 50 MB.")
            df = pd.read_excel(io.BytesIO(content), nrows=MAX_ROWS + 1)
        elif suffix == ".json":
            df = pd.read_json(io.BytesIO(content))
        elif suffix == ".parquet":
            import pyarrow.parquet as pq

            table = pq.ParquetFile(io.BytesIO(content))
            if table.metadata.num_rows > MAX_ROWS or len(table.schema.names) > MAX_COLUMNS:
                raise ValueError("Parquet exceeds row or column limits.")
            if (
                sum(
                    table.metadata.row_group(i).total_byte_size
                    for i in range(table.metadata.num_row_groups)
                )
                > 50 * 1024 * 1024
            ):
                raise ValueError("Expanded Parquet exceeds 50 MB.")
            df = table.read().to_pandas()
        else:
            raise ValueError("Supported formats: CSV, XLSX, JSON, Parquet.")

        return validate_dataframe(df)
    except Exception as err:
        raise ValueError(f"Could not read dataset: {err}") from err


def preview_records(df: pd.DataFrame) -> list[dict[str, Any]]:
    """Convert head rows into JSON-safe dictionaries with nulls for missing values."""
    return json.loads(df.head(10).to_json(orient="records", date_format="iso") or "[]")


# ---------------------------------------------------------------------------
# Schema and Type Inference
# ---------------------------------------------------------------------------


def infer_column_type(series: pd.Series) -> str:
    """Determine semantic column type: numerical, datetime, boolean, categorical, or text."""
    if pd.api.types.is_bool_dtype(series):
        return "boolean"
    if pd.api.types.is_numeric_dtype(series):
        return "numerical"
    if pd.api.types.is_datetime64_any_dtype(series):
        return "datetime"

    non_nulls = series.dropna()
    if len(non_nulls) > 0:
        first_few = non_nulls.head(5).astype(str)
        if first_few.str.match(r"^\d{4}[-/]\d{2}[-/]\d{2}").all():
            if pd.to_datetime(non_nulls, errors="coerce", format="mixed").notna().all():
                return "datetime"

    unique_count = series.nunique()
    total_count = len(non_nulls)
    if total_count > 0 and (
        unique_count / total_count <= HIGH_CARDINALITY_RATIO or unique_count <= 20
    ):
        return "categorical"
    return "text"


def inspect_columns(df: pd.DataFrame) -> list[ColumnSummary]:
    """Inspect each column and return descriptive metadata."""
    summaries = []
    total_rows = len(df)
    for col in df.columns:
        series = df[col]
        null_count = int(series.isna().sum())
        null_pct = round((null_count / total_rows) * 100.0, 2) if total_rows > 0 else 0.0
        samples = [
            v.item() if isinstance(v, (np.integer, np.floating)) else str(v)
            for v in series.dropna().head(3)
        ]
        summaries.append(
            ColumnSummary(
                name=col,
                dtype=str(series.dtype),
                original_dtype=str(series.dtype),
                inferred_type=infer_column_type(series),
                null_count=null_count,
                null_percentage=null_pct,
                unique_count=int(series.nunique()),
                sample_values=samples,
            )
        )
    return summaries


def detect_potential_targets(df: pd.DataFrame) -> list[PotentialTarget]:
    """Identify columns that could serve as prediction targets."""
    candidates = []
    keywords = {
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
    }
    for col in df.columns:
        col_lower = col.lower()
        series = df[col]
        if col_lower in {"id", "index", "row_id", "uuid", "guid"} or series.nunique() <= 1:
            continue
        is_keyword = any(kw in col_lower for kw in keywords)
        if pd.api.types.is_numeric_dtype(series):
            if series.nunique() == 2:
                candidates.append(
                    PotentialTarget(column=col, suggested_type="binary_classification")
                )
            elif is_keyword or series.nunique() > 10:
                candidates.append(PotentialTarget(column=col, suggested_type="regression"))
        elif series.nunique() <= 10 and is_keyword:
            suggested = (
                "binary_classification" if series.nunique() == 2 else "multiclass_classification"
            )
            candidates.append(PotentialTarget(column=col, suggested_type=suggested))
    return candidates


# ---------------------------------------------------------------------------
# Data Quality & Health Score
# ---------------------------------------------------------------------------


def calculate_health_score(df: pd.DataFrame) -> int:
    """Calculate overall dataset health score from 0 to 100."""
    if df.size == 0:
        return 0
    missing_ratio = float(df.isna().sum().sum()) / df.size
    duplicate_ratio = float(df.duplicated().sum()) / len(df) if len(df) > 0 else 0.0
    score = 100.0 - (missing_ratio * 50.0) - (duplicate_ratio * 30.0)
    return max(0, min(100, int(round(score))))


def compute_quality_profile(df: pd.DataFrame) -> DataQuality:
    """Audit missing values, duplicates, IQR/Z-score outliers, and cardinality."""
    total_rows = len(df)
    total_cells = df.size
    missing_counts = df.isna().sum()
    total_missing = int(missing_counts.sum())
    missing_pct = round((total_missing / total_cells) * 100.0, 2) if total_cells > 0 else 0.0

    complete_rows = int((~df.isna().any(axis=1)).sum())
    rows_with_missing = total_rows - complete_rows

    col_missing_profiles = []
    cols_with_missing = 0
    for col in df.columns:
        m_count = int(missing_counts[col])
        if m_count > 0:
            cols_with_missing += 1
        m_pct = round((m_count / total_rows) * 100.0, 2) if total_rows > 0 else 0.0
        status = (
            "clean"
            if m_count == 0
            else ("minor" if m_pct < 5.0 else ("moderate" if m_pct < 20.0 else "severe"))
        )
        col_missing_profiles.append(
            {
                "column": col,
                "missing_count": m_count,
                "missing_percentage": m_pct,
                "status": status,
            }
        )

    missing_profile = MissingValueProfile(
        total_cells=total_cells,
        total_missing_cells=total_missing,
        overall_missing_percentage=missing_pct,
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
        recommendation="Dataset is complete with no missing values."
        if total_missing == 0
        else f"Consider imputing or dropping {total_missing} missing values before deep modeling.",
    )

    duplicate_count = int(df.duplicated().sum())
    duplicate_pct = round((duplicate_count / total_rows) * 100.0, 2) if total_rows > 0 else 0.0
    id_col = next((c for c in df.columns if c.lower() in {"id", "index", "row_id"}), None)
    has_id_collision = bool(id_col and df[id_col].duplicated().any())

    dup_profile = DuplicateProfile(
        total_rows=total_rows,
        duplicate_rows_count=duplicate_count,
        duplicate_rows_percentage=duplicate_pct,
        unique_rows_count=total_rows - duplicate_count,
        status="clean"
        if duplicate_count == 0
        else ("moderate" if duplicate_pct < 5.0 else "severe"),
        has_key_column_collisions=has_id_collision,
        key_column_name=id_col,
        key_collision_count=int(df[id_col].duplicated().sum())
        if has_id_collision and id_col
        else 0,
        recommendation="No duplicate rows detected."
        if duplicate_count == 0
        else f"Remove {duplicate_count} duplicate rows to avoid data bias.",
    )

    numeric_cols = [
        c
        for c in df.columns
        if pd.api.types.is_numeric_dtype(df[c]) and not pd.api.types.is_bool_dtype(df[c])
    ]
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
        lower = q25 - (1.5 * iqr)
        upper = q75 + (1.5 * iqr)
        outlier_count = int(((series < lower) | (series > upper)).sum())
        outlier_pct = round((outlier_count / len(series)) * 100.0, 2)

        if outlier_count > 0:
            cols_with_outliers += 1
            total_outliers += outlier_count

        severity = (
            "none"
            if outlier_count == 0
            else ("mild" if outlier_pct < 5.0 else ("notable" if outlier_pct < 15.0 else "extreme"))
        )
        std_val = float(series.std(ddof=0))
        z_count = int((((series - series.mean()) / std_val).abs() > 3).sum()) if std_val > 0 else 0
        z_pct = round((z_count / len(series)) * 100.0, 2) if std_val > 0 else 0.0

        outlier_profiles.append(
            {
                "column": col,
                "total_valid_count": len(series),
                "iqr_outlier_count": outlier_count,
                "iqr_outlier_percentage": outlier_pct,
                "iqr_lower_bound": round(lower, 4),
                "iqr_upper_bound": round(upper, 4),
                "zscore_outlier_count": z_count,
                "zscore_outlier_percentage": z_pct,
                "severity": severity,
                "context_note": f"Found {outlier_count} values outside the [{round(lower, 2)}, {round(upper, 2)}] IQR fence.",
            }
        )

    outlier_profile = OutlierProfile(
        total_numerical_columns_analyzed=len(numeric_cols),
        columns_with_outliers_count=cols_with_outliers,
        total_iqr_outliers=total_outliers,
        recommendation="No significant outliers detected."
        if total_outliers == 0
        else f"Found {total_outliers} mathematical outliers across {cols_with_outliers} columns. Verify if these are valid extreme values.",
        profiles=outlier_profiles,
    )

    cardinality_profile = CardinalityProfile(
        constant_columns=[c for c in df.columns if df[c].nunique() <= 1],
        quasi_constant_columns=[
            c
            for c in df.columns
            if df[c].nunique() == 2 and (df[c].value_counts().iloc[0] / len(df)) > 0.98
        ],
        high_cardinality_categorical_columns=[
            c
            for c in df.columns
            if not pd.api.types.is_numeric_dtype(df[c])
            and df[c].nunique() > 50
            and df[c].nunique() / len(df) > 0.5
        ],
        recommendation="Cardinality distributions are normal."
        if not [c for c in df.columns if df[c].nunique() <= 1]
        else "Consider dropping constant columns as they provide no variance.",
    )

    return DataQuality(
        missing=missing_profile,
        duplicates=dup_profile,
        outliers=outlier_profile,
        cardinality=cardinality_profile,
    )


def format_memory_size(bytes_count: int) -> str:
    """Format bytes count into a human-readable string."""
    if bytes_count < 1024:
        return f"{bytes_count} B"
    if bytes_count < 1024 * 1024:
        return f"{bytes_count / 1024:.1f} KB"
    return f"{bytes_count / (1024 * 1024):.2f} MB"


def get_dataset_schema(df: pd.DataFrame) -> dict[str, Any]:
    """Compile structured schema metadata for a DataFrame."""
    columns_info = inspect_columns(df)
    memory_bytes = int(df.memory_usage(deep=True).sum())

    numerical_cols: list[str] = []
    categorical_cols: list[str] = []
    datetime_cols: list[str] = []
    text_cols: list[str] = []
    constant_cols: list[str] = []
    id_cols: list[str] = []
    high_card_cols: list[str] = []

    for col in columns_info:
        if col.inferred_type == "numerical":
            numerical_cols.append(col.name)
        elif col.inferred_type in {"categorical", "boolean"}:
            categorical_cols.append(col.name)
        elif col.inferred_type == "datetime":
            datetime_cols.append(col.name)
        else:
            text_cols.append(col.name)

        if col.unique_count <= 1:
            constant_cols.append(col.name)
        if col.name.lower() in {"id", "index", "row_id", "uuid"}:
            id_cols.append(col.name)
        if col.inferred_type == "categorical" and col.unique_count > 50:
            high_card_cols.append(col.name)

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
        "potential_targets": [t.model_dump() for t in detect_potential_targets(df)],
    }
