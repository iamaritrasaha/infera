"""Bivariate correlation analysis (Pearson & Spearman) with significance testing."""

from dataclasses import dataclass

import numpy as np
import pandas as pd
from scipy import stats


@dataclass
class CorrelationPair:
    """Detailed evidence-backed relationship between two variables."""

    feature_a: str
    feature_b: str
    pearson_r: float
    pearson_p_value: float
    spearman_rho: float
    spearman_p_value: float
    strength: str  # "very_strong", "strong", "moderate", "weak", "negligible"
    direction: str  # "positive", "negative", "none"
    is_statistically_significant: bool  # p < 0.05
    plain_english: str
    evidence_summary: dict[str, float | str | bool]


@dataclass
class CorrelationMatrix:
    """Full correlation matrices and key relationship rankings."""

    columns: list[str]
    pearson_matrix: list[list[float]]
    spearman_matrix: list[list[float]]
    top_correlations: list[CorrelationPair]
    notable_negative_correlations: list[CorrelationPair]


def _classify_strength(abs_r: float) -> str:
    """Classifies magnitude of correlation coefficient."""
    if abs_r >= 0.8:
        return "very_strong"
    elif abs_r >= 0.6:
        return "strong"
    elif abs_r >= 0.35:
        return "moderate"
    elif abs_r >= 0.15:
        return "weak"
    return "negligible"


def compute_correlations(
    df: pd.DataFrame, numerical_cols: list[str], max_pairs: int = 15
) -> CorrelationMatrix:
    """Calculates Pearson and Spearman correlation matrices with exact p-values."""
    # Filter numeric cols that exist and have non-zero variance
    valid_cols = []
    for c in numerical_cols:
        if c in df.columns:
            s = pd.to_numeric(df[c], errors="coerce").dropna()
            if len(s) >= 4 and s.std(ddof=1) > 1e-9:
                valid_cols.append(c)

    if len(valid_cols) < 2:
        return CorrelationMatrix(
            columns=valid_cols,
            pearson_matrix=[[1.0]] if len(valid_cols) == 1 else [],
            spearman_matrix=[[1.0]] if len(valid_cols) == 1 else [],
            top_correlations=[],
            notable_negative_correlations=[],
        )

    sub_df = df[valid_cols].apply(pd.to_numeric, errors="coerce")
    n_cols = len(valid_cols)

    p_mat: list[list[float]] = [[1.0] * n_cols for _ in range(n_cols)]
    s_mat: list[list[float]] = [[1.0] * n_cols for _ in range(n_cols)]
    pairs: list[CorrelationPair] = []

    for i in range(n_cols):
        col_i = valid_cols[i]
        for j in range(i + 1, n_cols):
            col_j = valid_cols[j]
            paired = sub_df[[col_i, col_j]].dropna()
            if len(paired) < 5:
                continue

            xi = paired[col_i].values
            xj = paired[col_j].values

            # Pearson
            try:
                pr_res = stats.pearsonr(xi, xj)
                r_val = float(pr_res.statistic)
                r_pval = float(pr_res.pvalue)
            except Exception:
                r_val, r_pval = 0.0, 1.0

            # Spearman
            try:
                sp_res = stats.spearmanr(xi, xj)
                s_val = float(sp_res.statistic)
                s_pval = float(sp_res.pvalue)
            except Exception:
                s_val, s_pval = 0.0, 1.0

            # Fill symmetric matrices
            r_clean = round(r_val, 4) if not np.isnan(r_val) else 0.0
            s_clean = round(s_val, 4) if not np.isnan(s_val) else 0.0
            p_mat[i][j] = p_mat[j][i] = r_clean
            s_mat[i][j] = s_mat[j][i] = s_clean

            # Pair metadata
            abs_r = abs(r_clean)
            strength = _classify_strength(abs_r)
            direction = "positive" if r_clean > 0 else ("negative" if r_clean < 0 else "none")
            is_sig = r_pval < 0.05

            # Plain english explanation
            dir_word = "positive" if direction == "positive" else "inverse"
            sig_word = "statistically significant" if is_sig else "not statistically significant"
            english = (
                f"'{col_i}' and '{col_j}' exhibit a {strength.replace('_', ' ')} {dir_word} correlation "
                f"(Pearson r = {r_clean:+.2f}, p = {r_pval:.4f}), which is {sig_word}."
            )

            pair_obj = CorrelationPair(
                feature_a=col_i,
                feature_b=col_j,
                pearson_r=r_clean,
                pearson_p_value=round(r_pval, 6),
                spearman_rho=s_clean,
                spearman_p_value=round(s_pval, 6),
                strength=strength,
                direction=direction,
                is_statistically_significant=is_sig,
                plain_english=english,
                evidence_summary={
                    "feature_a": col_i,
                    "feature_b": col_j,
                    "pearson_r": r_clean,
                    "pearson_p_value": round(r_pval, 6),
                    "spearman_rho": s_clean,
                    "sample_size": len(paired),
                    "is_significant": is_sig,
                },
            )
            pairs.append(pair_obj)

    # Sort pairs by absolute Pearson correlation descending
    pairs.sort(key=lambda x: abs(x.pearson_r), reverse=True)
    top_pos = [p for p in pairs if p.direction == "positive"][:max_pairs]
    top_neg = [p for p in pairs if p.direction == "negative"][:max_pairs]

    return CorrelationMatrix(
        columns=valid_cols,
        pearson_matrix=p_mat,
        spearman_matrix=s_mat,
        top_correlations=top_pos,
        notable_negative_correlations=top_neg,
    )
