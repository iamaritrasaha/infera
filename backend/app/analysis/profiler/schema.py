"""Dataset schema, column classification, and metadata detection."""

import re
from dataclasses import dataclass, field

import pandas as pd


@dataclass
class ColumnMeta:
    """Metadata for a single column."""

    name: str
    original_dtype: str
    inferred_type: str  # "numerical", "categorical", "datetime", "text", "boolean"
    total_count: int
    null_count: int
    null_percentage: float
    unique_count: int
    unique_ratio: float
    is_constant: bool
    is_high_cardinality: bool
    is_id_candidate: bool
    sample_values: list[str | int | float | bool | None] = field(default_factory=list)


@dataclass
class SchemaProfile:
    """Complete dataset schema profile."""

    row_count: int
    column_count: int
    memory_bytes: int
    memory_formatted: str
    columns: list[ColumnMeta]
    numerical_columns: list[str]
    categorical_columns: list[str]
    datetime_columns: list[str]
    text_columns: list[str]
    boolean_columns: list[str]
    constant_columns: list[str]
    high_cardinality_columns: list[str]
    id_columns: list[str]
    potential_targets: list[
        dict[str, str]
    ]  # list of {"column": name, "suggested_type": "regression" | "classification"}


def _format_bytes(size: int) -> str:
    """Format bytes to human readable string."""
    for unit in ["B", "KB", "MB", "GB"]:
        if size < 1024.0:
            return f"{size:.1f} {unit}"
        size /= 1024.0
    return f"{size:.1f} TB"


def _is_datetime_series(series: pd.Series) -> bool:
    """Check if series is or can be parsed as datetime without heavy false positives."""
    if pd.api.types.is_datetime64_any_dtype(series):
        return True
    if not (pd.api.types.is_object_dtype(series) or pd.api.types.is_string_dtype(series)):
        return False

    # Sample non-null values
    sample = series.dropna().head(20)
    if len(sample) == 0:
        return False

    # Avoid purely numeric strings being parsed as unix timestamps unless explicitly requested
    if all(str(val).strip().isdigit() for val in sample):
        return False

    try:
        parsed = pd.to_datetime(sample, errors="coerce", format="mixed")
        return parsed.notna().sum() >= max(1, int(len(sample) * 0.8))
    except Exception:
        return False


def _is_text_series(series: pd.Series) -> bool:
    """Determine if a string column is free-form text rather than a categorical label."""
    if not (pd.api.types.is_object_dtype(series) or pd.api.types.is_string_dtype(series)):
        return False

    sample = series.dropna().astype(str).head(30)
    if len(sample) == 0:
        return False

    # Average number of words per value
    avg_words = sum(len(val.split()) for val in sample) / len(sample)
    avg_length = sum(len(val) for val in sample) / len(sample)
    return avg_words > 3 or avg_length > 50


def _is_id_candidate(name: str, unique_count: int, total_rows: int) -> bool:
    """Check if a column is likely an identifier column."""
    name_lower = name.lower()
    id_keywords = ["id", "uuid", "guid", "code", "index", "key", "number", "no"]
    matches_name = any(k in re.split(r"[^a-z0-9]+", name_lower) for k in id_keywords) or name_lower.endswith("_id")
    is_unique = (total_rows > 10 and unique_count == total_rows) or (
        total_rows > 0 and (unique_count / total_rows) > 0.98
    )
    return matches_name and is_unique


def inspect_schema(df: pd.DataFrame) -> SchemaProfile:
    """Profiles the schema and classifies all columns in the dataframe."""
    row_count, col_count = df.shape
    memory_bytes = int(df.memory_usage(deep=True).sum())
    memory_formatted = _format_bytes(memory_bytes)

    columns: list[ColumnMeta] = []
    numerical_cols: list[str] = []
    categorical_cols: list[str] = []
    datetime_cols: list[str] = []
    text_cols: list[str] = []
    boolean_cols: list[str] = []
    constant_cols: list[str] = []
    high_cardinality_cols: list[str] = []
    id_cols: list[str] = []
    potential_targets: list[dict[str, str]] = []

    for col in df.columns:
        series = df[col]
        total_count = len(series)
        null_count = int(series.isna().sum())
        null_pct = round((null_count / total_count * 100.0) if total_count > 0 else 0.0, 2)
        unique_count = int(series.nunique(dropna=True))
        unique_ratio = round((unique_count / total_count) if total_count > 0 else 0.0, 4)

        is_constant = unique_count <= 1
        if is_constant:
            constant_cols.append(col)

        is_id = _is_id_candidate(str(col), unique_count, row_count)
        if is_id:
            id_cols.append(col)

        # Infer type
        inferred_type = "categorical"
        if pd.api.types.is_bool_dtype(series):
            inferred_type = "boolean"
            boolean_cols.append(col)
            categorical_cols.append(col)
        elif _is_datetime_series(series):
            inferred_type = "datetime"
            datetime_cols.append(col)
        elif pd.api.types.is_numeric_dtype(series):
            # Check if it's integer with only 2 unique values (treat as binary categorical candidate)
            if unique_count == 2 and not is_id:
                inferred_type = "numerical"
                numerical_cols.append(col)
                categorical_cols.append(col)  # Dual-purpose for binary target consideration
            else:
                inferred_type = "numerical"
                numerical_cols.append(col)
        elif _is_text_series(series):
            inferred_type = "text"
            text_cols.append(col)
        else:
            inferred_type = "categorical"
            categorical_cols.append(col)

        # High cardinality flag
        is_high_card = (
            not pd.api.types.is_numeric_dtype(series) and unique_count > 30 and unique_ratio > 0.4
        )
        if is_high_card:
            high_cardinality_cols.append(col)

        # Detect potential targets
        # Exclude IDs, constants, text, datetimes
        if not is_id and not is_constant and inferred_type not in ["text", "datetime"]:
            if inferred_type == "numerical" and unique_count > 10:
                potential_targets.append({"column": col, "suggested_type": "regression"})
            elif unique_count >= 2 and unique_count <= 15:
                sub_type = (
                    "binary_classification" if unique_count == 2 else "multiclass_classification"
                )
                potential_targets.append({"column": col, "suggested_type": sub_type})

        # Sample values (up to 5)
        raw_samples = series.dropna().head(5).tolist()
        sample_values = [
            None if pd.isna(v) else (v if isinstance(v, (int, float, bool, str)) else str(v))
            for v in raw_samples
        ]

        columns.append(
            ColumnMeta(
                name=str(col),
                original_dtype=str(series.dtype),
                inferred_type=inferred_type,
                total_count=total_count,
                null_count=null_count,
                null_percentage=null_pct,
                unique_count=unique_count,
                unique_ratio=unique_ratio,
                is_constant=is_constant,
                is_high_cardinality=is_high_card,
                is_id_candidate=is_id,
                sample_values=sample_values,
            )
        )

    # Dedup categorical / numerical overlaps if any
    numerical_cols = list(dict.fromkeys(numerical_cols))
    categorical_cols = list(dict.fromkeys(categorical_cols))

    return SchemaProfile(
        row_count=row_count,
        column_count=col_count,
        memory_bytes=memory_bytes,
        memory_formatted=memory_formatted,
        columns=columns,
        numerical_columns=numerical_cols,
        categorical_columns=categorical_cols,
        datetime_columns=datetime_cols,
        text_columns=text_cols,
        boolean_columns=boolean_cols,
        constant_columns=constant_cols,
        high_cardinality_columns=high_cardinality_cols,
        id_columns=id_cols,
        potential_targets=potential_targets,
    )
