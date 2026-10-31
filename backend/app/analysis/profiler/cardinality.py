"""Cardinality inspection, quasi-constant detection, and encoding safety."""

from dataclasses import dataclass

import pandas as pd


@dataclass
class ColumnCardinality:
    """Cardinality summary for a single column."""

    column: str
    unique_count: int
    unique_ratio: float
    is_constant: bool
    is_quasi_constant: bool
    most_frequent_value_pct: float
    is_high_cardinality: bool
    encoding_recommendation: str


@dataclass
class CardinalityProfile:
    """Dataset-wide cardinality summary."""

    constant_columns: list[str]
    quasi_constant_columns: list[str]
    high_cardinality_categorical_columns: list[str]
    column_details: list[ColumnCardinality]
    recommendation: str


def analyze_cardinality(df: pd.DataFrame, categorical_cols: list[str]) -> CardinalityProfile:
    """Analyzes cardinality, flags constant and high-cardinality variables."""
    total_rows = len(df)
    constant_cols: list[str] = []
    quasi_constant_cols: list[str] = []
    high_card_cat_cols: list[str] = []
    details: list[ColumnCardinality] = []

    for col in df.columns:
        series = df[col].dropna()
        n_valid = len(series)
        if n_valid == 0:
            continue

        unique_count = int(series.nunique())
        unique_ratio = round((unique_count / total_rows) if total_rows > 0 else 0.0, 4)

        top_val_pct = round((float(series.value_counts().iloc[0]) / n_valid) * 100.0, 2)
        is_constant = unique_count <= 1
        is_quasi = not is_constant and top_val_pct >= 98.0
        is_cat = col in categorical_cols

        is_high_card = is_cat and (unique_count > 30 or (unique_ratio > 0.4 and unique_count > 10))

        if is_constant:
            constant_cols.append(str(col))
            rec = "Drop column: zero information variance."
        elif is_quasi:
            quasi_constant_cols.append(str(col))
            rec = "Caution: near-zero variance (>98% single value). Consider dropping."
        elif is_high_card:
            high_card_cat_cols.append(str(col))
            rec = "High cardinality: target encoding, frequency encoding, or grouping rare levels recommended."
        elif is_cat:
            rec = "Standard one-hot encoding or ordinal encoding suitable."
        else:
            rec = "Continuous numerical representation."

        details.append(
            ColumnCardinality(
                column=str(col),
                unique_count=unique_count,
                unique_ratio=unique_ratio,
                is_constant=is_constant,
                is_quasi_constant=is_quasi,
                most_frequent_value_pct=top_val_pct,
                is_high_cardinality=is_high_card,
                encoding_recommendation=rec,
            )
        )

    if constant_cols or quasi_constant_cols:
        rec_summary = f"Detected {len(constant_cols)} constant and {len(quasi_constant_cols)} quasi-constant columns that provide negligible predictive variance."
    else:
        rec_summary = "All features exhibit healthy variance across observations."

    return CardinalityProfile(
        constant_columns=constant_cols,
        quasi_constant_columns=quasi_constant_cols,
        high_cardinality_categorical_columns=high_card_cat_cols,
        column_details=details,
        recommendation=rec_summary,
    )
