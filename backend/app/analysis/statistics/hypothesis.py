"""Automated hypothesis testing suite with rigorous statistical interpretations."""

from dataclasses import dataclass

import numpy as np
import pandas as pd
from scipy import stats


@dataclass
class HypothesisTestResult:
    """Rigorous, evidence-based hypothesis test result."""

    test_name: str
    feature_a: str
    feature_b: str
    null_hypothesis: str
    alt_hypothesis: str
    statistic_name: str
    statistic_value: float
    p_value: float
    alpha: float
    is_rejected: bool
    interpretation: str
    assumptions_note: str


def run_two_sample_tests(
    df: pd.DataFrame,
    numerical_col: str,
    binary_col: str,
    alpha: float = 0.05,
) -> list[HypothesisTestResult]:
    """Runs Welch's/Student's t-test and Mann-Whitney U on numerical variable split by binary factor."""
    clean = df[[numerical_col, binary_col]].dropna()
    groups = clean.groupby(binary_col)[numerical_col].apply(list)
    if len(groups) != 2:
        return []

    labels = list(groups.keys())
    g1, g2 = np.array(groups[labels[0]], dtype=float), np.array(groups[labels[1]], dtype=float)
    if len(g1) < 4 or len(g2) < 4:
        return []

    results = []

    # Levene's test for equality of variance
    try:
        _, lev_p = stats.levene(g1, g2)
        equal_var = lev_p > 0.05
    except Exception:
        equal_var = False

    test_type = "Student's Two-Sample t-Test" if equal_var else "Welch's Two-Sample t-Test"
    ttest_res = stats.ttest_ind(g1, g2, equal_var=equal_var)
    t_stat = float(ttest_res.statistic)
    t_pval = float(ttest_res.pvalue)

    rejected_t = t_pval < alpha
    interp_t = (
        f"At alpha = {alpha}, there is statistically significant evidence of a difference in mean "
        f"'{numerical_col}' between '{binary_col}'={labels[0]} (mean={g1.mean():.2f}) and "
        f"'{binary_col}'={labels[1]} (mean={g2.mean():.2f})."
        if rejected_t
        else f"At alpha = {alpha}, there is insufficient evidence to conclude a significant difference in mean "
        f"'{numerical_col}' between the two groups."
    )

    results.append(
        HypothesisTestResult(
            test_name=test_type,
            feature_a=numerical_col,
            feature_b=binary_col,
            null_hypothesis=f"The true population means of '{numerical_col}' are identical across {labels[0]} and {labels[1]}.",
            alt_hypothesis=f"The true population means of '{numerical_col}' differ between {labels[0]} and {labels[1]}.",
            statistic_name="t-statistic",
            statistic_value=round(t_stat, 4),
            p_value=round(t_pval, 6),
            alpha=alpha,
            is_rejected=rejected_t,
            interpretation=interp_t,
            assumptions_note=(
                f"Levene test p-value: {lev_p:.4f}. Assumed equal variance: {equal_var}. "
                "Assumes independent samples and approximate normality of sample means."
            ),
        )
    )

    # Mann-Whitney U Test (Non-parametric)
    try:
        mwu_res = stats.mannwhitneyu(g1, g2, alternative="two-sided")
        u_stat = float(mwu_res.statistic)
        u_pval = float(mwu_res.pvalue)
        rejected_u = u_pval < alpha
        interp_u = (
            f"The non-parametric rank test provides evidence of a stochastically significant difference in the distribution "
            f"of '{numerical_col}' across '{binary_col}' groups."
            if rejected_u
            else "The distributions of ranks do not show statistically significant divergence."
        )

        results.append(
            HypothesisTestResult(
                test_name="Mann-Whitney U Test",
                feature_a=numerical_col,
                feature_b=binary_col,
                null_hypothesis=f"The distribution of '{numerical_col}' is identical across {labels[0]} and {labels[1]}.",
                alt_hypothesis=f"The distribution of '{numerical_col}' differs stochastically between the two groups.",
                statistic_name="U-statistic",
                statistic_value=round(u_stat, 2),
                p_value=round(u_pval, 6),
                alpha=alpha,
                is_rejected=rejected_u,
                interpretation=interp_u,
                assumptions_note="Non-parametric test. Robust to extreme outliers and non-normal distributions.",
            )
        )
    except Exception:
        pass

    return results


def run_anova_tests(
    df: pd.DataFrame,
    numerical_col: str,
    multiclass_col: str,
    alpha: float = 0.05,
) -> list[HypothesisTestResult]:
    """Runs One-way ANOVA and Kruskal-Wallis test across multiple levels."""
    clean = df[[numerical_col, multiclass_col]].dropna()
    groups_dict = clean.groupby(multiclass_col)[numerical_col].apply(list)
    groups = [np.array(vals, dtype=float) for vals in groups_dict.values if len(vals) >= 4]

    if len(groups) < 3:
        return []

    results = []

    # One-Way ANOVA
    try:
        f_res = stats.f_oneway(*groups)
        f_stat = float(f_res.statistic)
        f_pval = float(f_res.pvalue)
        rejected_f = f_pval < alpha

        results.append(
            HypothesisTestResult(
                test_name="One-Way Analysis of Variance (ANOVA)",
                feature_a=numerical_col,
                feature_b=multiclass_col,
                null_hypothesis=f"All {len(groups)} group population means of '{numerical_col}' are equal.",
                alt_hypothesis=f"At least one group population mean of '{numerical_col}' is different.",
                statistic_name="F-statistic",
                statistic_value=round(f_stat, 4),
                p_value=round(f_pval, 6),
                alpha=alpha,
                is_rejected=rejected_f,
                interpretation=(
                    f"Statistical evidence indicates group means of '{numerical_col}' differ significantly across '{multiclass_col}' levels."
                    if rejected_f
                    else f"Differences in mean '{numerical_col}' across '{multiclass_col}' categories could be attributed to random sampling variability."
                ),
                assumptions_note="Assumes normal distribution within groups and homogeneity of variance across groups.",
            )
        )
    except Exception:
        pass

    # Kruskal-Wallis H Test
    try:
        kw_res = stats.kruskal(*groups)
        h_stat = float(kw_res.statistic)
        h_pval = float(kw_res.pvalue)
        rejected_h = h_pval < alpha

        results.append(
            HypothesisTestResult(
                test_name="Kruskal-Wallis H-Test",
                feature_a=numerical_col,
                feature_b=multiclass_col,
                null_hypothesis=f"The median ranks of '{numerical_col}' are equal across all levels of '{multiclass_col}'.",
                alt_hypothesis=f"At least one group has a distinct rank distribution for '{numerical_col}'.",
                statistic_name="H-statistic",
                statistic_value=round(h_stat, 4),
                p_value=round(h_pval, 6),
                alpha=alpha,
                is_rejected=rejected_h,
                interpretation=(
                    f"Non-parametric evidence confirms rank distribution differences across categories of '{multiclass_col}'."
                    if rejected_h
                    else "No significant rank divergence observed across categories."
                ),
                assumptions_note="Non-parametric alternative to ANOVA, resistant to outliers and non-normality.",
            )
        )
    except Exception:
        pass

    return results


def run_chi_square_test(
    df: pd.DataFrame,
    cat_col_a: str,
    cat_col_b: str,
    alpha: float = 0.05,
) -> HypothesisTestResult | None:
    """Runs Pearson Chi-Square test of independence between two categorical variables."""
    clean = df[[cat_col_a, cat_col_b]].dropna()
    if len(clean) < 15:
        return None

    ctab = pd.crosstab(clean[cat_col_a], clean[cat_col_b])
    if ctab.shape[0] < 2 or ctab.shape[1] < 2:
        return None

    try:
        chi2_res = stats.chi2_contingency(ctab)
        chi2_stat = float(chi2_res.statistic)
        p_val = float(chi2_res.pvalue)
        dof = int(chi2_res.dof)
        rejected = p_val < alpha

        return HypothesisTestResult(
            test_name="Pearson Chi-Square Test of Independence",
            feature_a=cat_col_a,
            feature_b=cat_col_b,
            null_hypothesis=f"'{cat_col_a}' and '{cat_col_b}' are statistically independent.",
            alt_hypothesis=f"There is a significant association/dependence between '{cat_col_a}' and '{cat_col_b}'.",
            statistic_name="Chi2-statistic",
            statistic_value=round(chi2_stat, 4),
            p_value=round(p_val, 6),
            alpha=alpha,
            is_rejected=rejected,
            interpretation=(
                f"Statistically significant association detected between '{cat_col_a}' and '{cat_col_b}' (p = {p_val:.4f})."
                if rejected
                else f"No statistically significant association detected between '{cat_col_a}' and '{cat_col_b}'."
            ),
            assumptions_note=f"Contingency matrix size: {ctab.shape[0]}x{ctab.shape[1]}, Degrees of freedom: {dof}.",
        )
    except Exception:
        return None


def run_automated_hypothesis_suite(
    df: pd.DataFrame,
    numerical_cols: list[str],
    categorical_cols: list[str],
    target_col: str | None = None,
    max_tests: int = 10,
) -> list[HypothesisTestResult]:
    """Discovers and executes relevant statistical hypothesis tests."""
    all_tests: list[HypothesisTestResult] = []

    # Priority 1: Target-involved tests if target specified
    if target_col:
        if target_col in numerical_cols:
            for cat in categorical_cols:
                if cat == target_col or cat not in df.columns:
                    continue
                nunique = df[cat].dropna().nunique()
                if nunique == 2:
                    all_tests.extend(run_two_sample_tests(df, target_col, cat))
                elif 3 <= nunique <= 8:
                    all_tests.extend(run_anova_tests(df, target_col, cat))
        elif target_col in categorical_cols:
            for num in numerical_cols:
                if num == target_col or num not in df.columns:
                    continue
                nunique = df[target_col].dropna().nunique()
                if nunique == 2:
                    all_tests.extend(run_two_sample_tests(df, num, target_col))
                elif 3 <= nunique <= 8:
                    all_tests.extend(run_anova_tests(df, num, target_col))
            for cat in categorical_cols:
                if cat != target_col and cat in df.columns:
                    t = run_chi_square_test(df, target_col, cat)
                    if t:
                        all_tests.append(t)

    # Priority 2: General pair tests if quota remains
    if len(all_tests) < max_tests:
        # Check numerical with 2-level categoricals
        for cat in categorical_cols:
            if cat not in df.columns or df[cat].dropna().nunique() != 2:
                continue
            for num in numerical_cols:
                if num not in df.columns or (
                    target_col and (num == target_col or cat == target_col)
                ):
                    continue
                all_tests.extend(run_two_sample_tests(df, num, cat))
                if len(all_tests) >= max_tests:
                    break
            if len(all_tests) >= max_tests:
                break

    if len(all_tests) < max_tests:
        # Check categorical pairs
        for i in range(len(categorical_cols)):
            for j in range(i + 1, len(categorical_cols)):
                c1, c2 = categorical_cols[i], categorical_cols[j]
                if target_col and (c1 == target_col or c2 == target_col):
                    continue
                t = run_chi_square_test(df, c1, c2)
                if t:
                    all_tests.append(t)
                if len(all_tests) >= max_tests:
                    break
            if len(all_tests) >= max_tests:
                break

    return all_tests[:max_tests]
