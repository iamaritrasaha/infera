"""Missing value analysis and reporting."""

from dataclasses import dataclass

import pandas as pd


@dataclass
class ColumnMissingProfile:
    """Missing value stats for a single column."""

    column: str
    missing_count: int
    missing_percentage: float
    status: str  # "clean", "minor", "moderate", "severe"


@dataclass
class MissingProfile:
    """Comprehensive missing value profile."""

    total_cells: int
    total_missing_cells: int
    overall_missing_percentage: float
    total_rows: int
    complete_rows_count: int
    complete_rows_percentage: float
    rows_with_missing_count: int
    rows_with_missing_percentage: float
    columns_with_missing_count: int
    column_profiles: list[ColumnMissingProfile]
    recommendation: str


def analyze_missing_values(df: pd.DataFrame) -> MissingProfile:
    """Computes comprehensive missing value metrics for the dataframe."""
    row_count, col_count = df.shape
    total_cells = row_count * col_count

    if total_cells == 0:
        return MissingProfile(
            total_cells=0,
            total_missing_cells=0,
            overall_missing_percentage=0.0,
            total_rows=0,
            complete_rows_count=0,
            complete_rows_percentage=100.0,
            rows_with_missing_count=0,
            rows_with_missing_percentage=0.0,
            columns_with_missing_count=0,
            column_profiles=[],
            recommendation="Dataset is empty.",
        )

    null_matrix = df.isna()
    total_missing_cells = int(null_matrix.sum().sum())
    overall_missing_pct = round((total_missing_cells / total_cells) * 100.0, 2)

    rows_with_missing = int((null_matrix.sum(axis=1) > 0).sum())
    complete_rows = row_count - rows_with_missing
    complete_rows_pct = round((complete_rows / row_count) * 100.0, 2)
    rows_with_missing_pct = round((rows_with_missing / row_count) * 100.0, 2)

    column_profiles: list[ColumnMissingProfile] = []
    columns_with_missing_count = 0

    for col in df.columns:
        missing_count = int(null_matrix[col].sum())
        missing_pct = round((missing_count / row_count) * 100.0, 2)

        if missing_count > 0:
            columns_with_missing_count += 1

        if missing_pct == 0.0:
            status = "clean"
        elif missing_pct < 5.0:
            status = "minor"
        elif missing_pct <= 20.0:
            status = "moderate"
        else:
            status = "severe"

        column_profiles.append(
            ColumnMissingProfile(
                column=str(col),
                missing_count=missing_count,
                missing_percentage=missing_pct,
                status=status,
            )
        )

    # Sort columns by highest missing percentage first
    column_profiles.sort(key=lambda x: x.missing_percentage, reverse=True)

    # Contextual recommendation
    if overall_missing_pct == 0.0:
        recommendation = "Dataset is completely intact with zero missing entries."
    elif overall_missing_pct < 3.0:
        recommendation = (
            "Minimal missing data detected. Median/mode imputation or simple row dropping is safe."
        )
    elif overall_missing_pct < 15.0:
        recommendation = "Moderate missing data present. Targeted imputation (median for numerical, mode/constant for categorical) is advised before model training."
    else:
        recommendation = "Substantial missing data detected. Columns with >40% missing entries should be considered for removal to prevent imputation distortion."

    return MissingProfile(
        total_cells=total_cells,
        total_missing_cells=total_missing_cells,
        overall_missing_percentage=overall_missing_pct,
        total_rows=row_count,
        complete_rows_count=complete_rows,
        complete_rows_percentage=complete_rows_pct,
        rows_with_missing_count=rows_with_missing,
        rows_with_missing_percentage=rows_with_missing_pct,
        columns_with_missing_count=columns_with_missing_count,
        column_profiles=column_profiles,
        recommendation=recommendation,
    )
