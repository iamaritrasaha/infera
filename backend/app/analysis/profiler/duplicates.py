"""Duplicate row detection and evaluation."""

from dataclasses import dataclass

import pandas as pd


@dataclass
class DuplicateProfile:
    """Duplicate records analysis result."""

    total_rows: int
    duplicate_rows_count: int
    duplicate_rows_percentage: float
    unique_rows_count: int
    status: str  # "clean", "moderate", "severe"
    has_key_column_collisions: bool
    key_column_name: str | None
    key_collision_count: int
    recommendation: str


def analyze_duplicates(df: pd.DataFrame, id_columns: list[str] | None = None) -> DuplicateProfile:
    """Identifies exact duplicate rows and primary key collisions."""
    total_rows = len(df)
    if total_rows == 0:
        return DuplicateProfile(
            total_rows=0,
            duplicate_rows_count=0,
            duplicate_rows_percentage=0.0,
            unique_rows_count=0,
            status="clean",
            has_key_column_collisions=False,
            key_column_name=None,
            key_collision_count=0,
            recommendation="Dataset is empty.",
        )

    duplicate_count = int(df.duplicated().sum())
    duplicate_pct = round((duplicate_count / total_rows) * 100.0, 2)
    unique_rows = total_rows - duplicate_count

    # Check potential ID collision
    key_col = None
    key_collisions = 0
    has_collisions = False
    if id_columns:
        for col in id_columns:
            if col in df.columns:
                dup_ids = int(df[col].duplicated().sum())
                if dup_ids > 0:
                    key_col = col
                    key_collisions = dup_ids
                    has_collisions = True
                    break

    if duplicate_pct == 0.0 and not has_collisions:
        status = "clean"
        recommendation = "All records are unique across all dimensions."
    elif duplicate_pct < 5.0 and not has_collisions:
        status = "moderate"
        recommendation = f"{duplicate_count} duplicate rows ({duplicate_pct}%) detected. Deduplication is recommended before model training."
    else:
        status = "severe"
        detail = (
            f" Key column '{key_col}' has {key_collisions} duplicates." if has_collisions else ""
        )
        recommendation = f"Severe duplication detected ({duplicate_pct}%).{detail} De-duplication should be executed to avoid data leakage and distorted sample weights."

    return DuplicateProfile(
        total_rows=total_rows,
        duplicate_rows_count=duplicate_count,
        duplicate_rows_percentage=duplicate_pct,
        unique_rows_count=unique_rows,
        status=status,
        has_key_column_collisions=has_collisions,
        key_column_name=key_col,
        key_collision_count=key_collisions,
        recommendation=recommendation,
    )
