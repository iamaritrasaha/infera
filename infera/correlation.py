"""Correlation analysis for numerical columns.

This module computes pairwise relationships between numerical variables using
both Pearson (linear) and Spearman (monotonic rank) correlation coefficients.

Important pedagogical note:
A high correlation between Variable A and Variable B means they change together;
it does NOT prove that Variable A causes Variable B.
"""

from typing import Any

import numpy as np
import pandas as pd
from scipy import stats as sp_stats

from infera.models import CorrelationPair, CorrelationResult

# Correlation strength boundaries based on standard statistical conventions
STRONG_THRESHOLD = 0.7
MODERATE_THRESHOLD = 0.4
WEAK_THRESHOLD = 0.2

# Statistical significance alpha level (standard p < 0.05)
SIGNIFICANCE_ALPHA = 0.05


def classify_correlation(r: float) -> tuple[str, str]:
    """Classify correlation coefficient into strength and direction.

    Args:
        r: Correlation coefficient between -1.0 and 1.0.

    Returns:
        A tuple of (strength, direction).
        Strength is one of: "strong", "moderate", "weak", or "negligible".
        Direction is one of: "positive", "negative", or "neutral".
    """
    abs_r = abs(r)

    if abs_r >= STRONG_THRESHOLD:
        strength = "strong"
    elif abs_r >= MODERATE_THRESHOLD:
        strength = "moderate"
    elif abs_r >= WEAK_THRESHOLD:
        strength = "weak"
    else:
        strength = "negligible"

    if r > 0.05:
        direction = "positive"
    elif r < -0.05:
        direction = "negative"
    else:
        direction = "neutral"

    return strength, direction


def explain_correlation(feature_a: str, feature_b: str, r: float, p_value: float) -> str:
    """Produce a clear, plain-English summary of a relationship between two variables."""
    strength, direction = classify_correlation(r)

    if strength == "negligible":
        return f"There is virtually no linear relationship between '{feature_a}' and '{feature_b}' (r = {r:.2f})."

    direction_text = "increases" if direction == "positive" else "decreases"
    significance_text = (
        "statistically significant"
        if p_value < SIGNIFICANCE_ALPHA
        else "not statistically significant"
    )

    return (
        f"As '{feature_a}' increases, '{feature_b}' tends to {direction_text} "
        f"({strength} {direction} correlation, r = {r:.2f}, p = {p_value:.4f}, {significance_text}). "
        f"Note: This demonstrates statistical association, not causation."
    )


def compute_correlations(df: pd.DataFrame, numerical_columns: list[str]) -> CorrelationResult:
    """Compute Pearson and Spearman correlation matrices and rank the strongest pairs.

    Args:
        df: The pandas DataFrame.
        numerical_columns: List of numerical column names to compare.

    Returns:
        CorrelationResult with matrices and top positive/negative pairs.
    """
    # Filter to columns that actually exist and have variance (not constant)
    valid_cols = [c for c in numerical_columns if c in df.columns and df[c].dropna().nunique() > 1]

    if len(valid_cols) < 2:
        return CorrelationResult(
            columns=valid_cols,
            pearson_matrix=[],
            spearman_matrix=[],
            top_correlations=[],
            notable_negative_correlations=[],
        )

    # 1. Full Correlation Matrices using pandas
    subset_df = df[valid_cols]
    pearson_df = subset_df.corr(method="pearson")
    spearman_df = subset_df.corr(method="spearman")

    # Convert to JSON-friendly lists of lists, replacing NaN with None
    def to_clean_matrix(matrix_df: pd.DataFrame) -> list[list[float | None]]:
        result: list[list[float | None]] = []
        for _, row in matrix_df.iterrows():
            clean_row = [round(float(val), 4) if pd.notna(val) else None for val in row]
            result.append(clean_row)
        return result

    pearson_matrix = to_clean_matrix(pearson_df)
    spearman_matrix = to_clean_matrix(spearman_df)

    # 2. Pairwise Analysis with p-values
    pairs: list[CorrelationPair] = []

    for i in range(len(valid_cols)):
        for j in range(i + 1, len(valid_cols)):
            col_a = valid_cols[i]
            col_b = valid_cols[j]

            # Drop rows where either column is NaN
            pair_data = subset_df[[col_a, col_b]].dropna()
            if (
                len(pair_data) < 3
                or pair_data[col_a].nunique() < 2
                or pair_data[col_b].nunique() < 2
            ):
                continue

            # Pearson r and p-value
            try:
                p_r, p_pval = sp_stats.pearsonr(pair_data[col_a], pair_data[col_b])
                if np.isnan(p_r):
                    p_r, p_pval = 0.0, 1.0
            except Exception:
                p_r, p_pval = 0.0, 1.0

            # Spearman rho and p-value
            try:
                s_rho, s_pval = sp_stats.spearmanr(pair_data[col_a], pair_data[col_b])
                if np.isnan(s_rho):
                    s_rho, s_pval = 0.0, 1.0
            except Exception:
                s_rho, s_pval = 0.0, 1.0

            strength, direction = classify_correlation(p_r)
            is_significant = p_pval < SIGNIFICANCE_ALPHA
            plain_text = explain_correlation(col_a, col_b, p_r, p_pval)

            evidence_summary: dict[str, Any] = {
                "sample_size": len(pair_data),
                "pearson_r": round(float(p_r), 4),
                "spearman_rho": round(float(s_rho), 4),
            }

            pairs.append(
                CorrelationPair(
                    feature_a=col_a,
                    feature_b=col_b,
                    pearson_r=round(float(p_r), 4),
                    pearson_p_value=round(float(p_pval), 6),
                    spearman_rho=round(float(s_rho), 4),
                    spearman_p_value=round(float(s_pval), 6),
                    strength=strength,
                    direction=direction,
                    is_statistically_significant=is_significant,
                    plain_english=plain_text,
                    evidence_summary=evidence_summary,
                )
            )

    # Sort positive correlations from highest to lowest
    positive_pairs = [p for p in pairs if p.pearson_r > 0]
    positive_pairs.sort(key=lambda p: p.pearson_r, reverse=True)

    # Sort negative correlations from most negative to least negative
    negative_pairs = [p for p in pairs if p.pearson_r < 0]
    negative_pairs.sort(key=lambda p: p.pearson_r)

    return CorrelationResult(
        columns=valid_cols,
        pearson_matrix=pearson_matrix,
        spearman_matrix=spearman_matrix,
        top_correlations=positive_pairs[:10],
        notable_negative_correlations=negative_pairs[:10],
    )
