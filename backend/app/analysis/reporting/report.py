"""Comprehensive report generator producing professional Markdown and standalone HTML reports."""

from datetime import datetime


def generate_markdown_report(result_payload: dict) -> str:
    """Generates an executive-grade, rigorous Markdown analysis report."""
    dataset_name = result_payload.get("dataset_name", "Uploaded Dataset")
    result_payload.get("summary", {})
    health = result_payload.get("health_score", 100)
    schema = result_payload.get("schema", {})
    quality = result_payload.get("quality", {})
    correlations = result_payload.get("correlations", {})
    hypothesis = result_payload.get("hypothesis_tests", [])
    problem = result_payload.get("problem_detection", {})
    result_payload.get("plan", {})
    models = result_payload.get("modeling", {})
    clustering = result_payload.get("clustering")
    result_payload.get("pca")
    result_payload.get("timeseries")
    insights = result_payload.get("insights", [])

    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S UTC")

    md = f"""# INFERA DATA SCIENCE EVIDENCE REPORT
**Dataset:** `{dataset_name}`
**Generated At:** {now_str}
**Integrity Score:** {health}/100
**Analysis Engine:** Infera Automated Data Science Platform

---

## 1. Executive Summary

Infera executed an end-to-end automated empirical analysis of `{dataset_name}`.
- **Dataset Dimensions:** {schema.get("row_count", 0):,} observations across {schema.get("column_count", 0)} attributes.
- **Data Integrity Score:** **{health}/100** ({"High Quality" if health >= 80 else "Requires Preprocessing"}).
- **Formulated Objective:** **{problem.get("problem_type", "exploratory").replace("_", " ").title()}** on target `{problem.get("target_column") or "None"}`.
- **Problem Rationale:** {problem.get("reason", "N/A")}

---

## 2. Dataset Architecture & Schema

| Dimension | Count | Identified Attributes |
| :--- | :--- | :--- |
| **Numerical** | {len(schema.get("numerical_columns", []))} | {", ".join(schema.get("numerical_columns", [])[:8]) or "None"} |
| **Categorical** | {len(schema.get("categorical_columns", []))} | {", ".join(schema.get("categorical_columns", [])[:8]) or "None"} |
| **Datetime** | {len(schema.get("datetime_columns", []))} | {", ".join(schema.get("datetime_columns", [])) or "None"} |
| **Identifiers / Keys** | {len(schema.get("id_columns", []))} | {", ".join(schema.get("id_columns", [])) or "None"} |
| **Constant / Quasi-Constant** | {len(schema.get("constant_columns", []))} | {", ".join(schema.get("constant_columns", [])) or "None"} |

*Memory Consumption:* `{schema.get("memory_formatted", "0 B")}`

---

## 3. Data Quality & Integrity Diagnostics

### Missing Value Profile
- **Total Missing Entries:** {quality.get("missing", {}).get("total_missing_cells", 0):,} ({quality.get("missing", {}).get("overall_missing_percentage", 0)}% of total matrix cells).
- **Complete Observations:** {quality.get("missing", {}).get("complete_rows_count", 0):,} ({quality.get("missing", {}).get("complete_rows_percentage", 100)}%).
- **Hygiene Recommendation:** {quality.get("missing", {}).get("recommendation", "Clean dataset.")}

### Duplicate Records & Outliers
- **Exact Duplicate Rows:** {quality.get("duplicates", {}).get("duplicate_rows_count", 0)} ({quality.get("duplicates", {}).get("duplicate_rows_percentage", 0)}%).
- **Statistical Extreme Outliers (IQR Method):** {quality.get("outliers", {}).get("total_iqr_outliers", 0)} instances identified across numerical features.
- **Outlier Diagnostic:** {quality.get("outliers", {}).get("recommendation", "No extreme variations.")}

---

## 4. Key Bivariate Relationships & Correlations

The empirical correlation engine computed Pearson linear coefficients and two-sided p-values:

"""
    top_corrs = correlations.get("top_correlations", [])
    if top_corrs:
        md += "| Feature A | Feature B | Pearson r | p-value | Relationship Strength |\n"
        md += "| :--- | :--- | :--- | :--- | :--- |\n"
        for c in top_corrs[:6]:
            md += f"| `{c.get('feature_a')}` | `{c.get('feature_b')}` | **{c.get('pearson_r'):+.3f}** | {c.get('pearson_p_value'):.4e} | {c.get('strength', '').replace('_', ' ').capitalize()} |\n"
    else:
        md += "*No significant pairwise numerical correlations detected.*\n"

    # Hypothesis Tests
    if hypothesis:
        md += "\n---\n\n## 5. Statistical Hypothesis Testing\n\n"
        for t in hypothesis[:4]:
            md += f"### {t.get('test_name')} (`{t.get('feature_a')}` vs `{t.get('feature_b')}`)\n"
            md += f"- **Null Hypothesis ($H_0$):** {t.get('null_hypothesis')}\n"
            md += f"- **Alternative Hypothesis ($H_1$):** {t.get('alt_hypothesis')}\n"
            md += f"- **Test Statistic:** {t.get('statistic_name')} = `{t.get('statistic_value')}` (p-value = `{t.get('p_value'):.4e}`, alpha = 0.05)\n"
            md += f"- **Empirical Decision:** **{'Reject $H_0$ (Statistically Significant)' if t.get('is_rejected') else 'Fail to Reject $H_0$ (Inconclusive)'}**\n"
            md += f"- **Statistical Interpretation:** {t.get('interpretation')}\n\n"

    # Machine Learning Benchmarking
    if models and models.get("summary_table"):
        prob_title = problem.get("problem_type", "supervised").replace("_", " ").title()
        md += f"""---

## 6. Machine Learning Model Benchmark ({prob_title})

**Target Feature:** `{models.get("target_column")}`
**Validation Strategy:** 80% Train ({models.get("train_samples")}), 20% Test ({models.get("test_samples")}) with Cross-Validation
**Champion Model:** **{models.get("best_model_name")}**

### Model Performance Comparison

"""
        if "regression" in problem.get("problem_type", ""):
            md += (
                "| Model Architecture | Test R² | Test RMSE | Test MAE | 5-Fold CV R² | Status |\n"
            )
            md += "| :--- | :--- | :--- | :--- | :--- | :--- |\n"
            for row in models.get("summary_table", []):
                best_badge = "**Champion**" if row.get("is_best") else "Evaluated"
                md += f"| {row.get('model')} | **{row.get('r2')}** | {row.get('rmse')} | {row.get('mae')} | {row.get('cv_r2')} | {best_badge} |\n"
        else:
            md += "| Model Architecture | Test Accuracy | Macro F1 | Macro Precision | Macro Recall | Status |\n"
            md += "| :--- | :--- | :--- | :--- | :--- | :--- |\n"
            for row in models.get("summary_table", []):
                best_badge = "**Champion**" if row.get("is_best") else "Evaluated"
                md += f"| {row.get('model')} | **{row.get('accuracy')}** | {row.get('f1_macro')} | {row.get('precision')} | {row.get('recall')} | {best_badge} |\n"

        md += f"\n> **Validation Insight:** {models.get('insight', '')}\n"

    # Clustering / Segmentation
    if clustering:
        md += f"""---

## 7. Unsupervised Clustering & Segmentation

- **Optimal Segments (K-Means):** k = {clustering.get("optimal_k")} (Silhouette Score = {clustering.get("kmeans_result", {}).get("silhouette", "N/A")})
- **Summary:** {clustering.get("summary_insight", "")}
"""

    # Insights
    if insights:
        md += "\n---\n\n## 8. Evidence-Backed Insights\n\n"
        for ins in insights:
            md += f"### {ins.get('title')}\n"
            md += f"{ins.get('plain_english')}\n\n"
            md += f"> **Computational Basis:** `{ins.get('calculation_details', '')}`\n\n"

    # Methodology and Limitations
    md += """---

## 9. Methodology & Scientific Limitations

1. **Determinism & Reproducibility:** All preprocessing, models, and tests run with fixed random seeds (`random_state=42`) using standard SciPy and Scikit-Learn algorithms.
2. **Leakage Prevention:** Transformers (imputers, scalers, encoders) are fitted strictly on training subsets and only evaluated on held-out test partitions.
3. **Causality Notice:** Correlations and hypothesis tests indicate statistical association under observational data. They do not substantiate unconfounded causal claims without randomized experimental controls.
4. **Model Boundaries:** Linear models assume additive relationships; tree ensembles capture non-linear interactions without assuming Gaussianity.

---
*Report generated autonomously by Infera. Turn data into evidence.*
"""
    return md


def generate_html_report(result_payload: dict) -> str:
    """Generates a standalone, beautifully styled HTML report ready for printing or viewing."""
    dataset_name = result_payload.get("dataset_name", "Uploaded Dataset")
    health = result_payload.get("health_score", 100)
    schema = result_payload.get("schema", {})
    problem = result_payload.get("problem_detection", {})
    models = result_payload.get("modeling", {})
    insights = result_payload.get("insights", [])

    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    insights_html = ""
    for ins in insights:
        insights_html += f"""
        <div style="margin-bottom: 1.5rem; padding: 1rem; border-left: 4px solid #2563eb; background: #f8fafc; border-radius: 4px;">
            <h4 style="margin: 0 0 0.5rem 0; color: #1e293b; font-size: 1.05rem;">{ins.get("title")}</h4>
            <p style="margin: 0 0 0.5rem 0; color: #475569; line-height: 1.5;">{ins.get("plain_english")}</p>
            <small style="color: #64748b; font-family: monospace;">Evidence: {ins.get("calculation_details", "")}</small>
        </div>
        """

    table_rows = ""
    if models and models.get("summary_table"):
        for row in models.get("summary_table", []):
            is_best = row.get("is_best", False)
            bg = "#eff6ff" if is_best else "#ffffff"
            weight = "bold" if is_best else "normal"
            metric_cols = "".join(
                [
                    f"<td style='padding: 8px 12px; border-bottom: 1px solid #e2e8f0;'>{v}</td>"
                    for k, v in row.items()
                    if k not in ["is_best", "model"]
                ]
            )
            table_rows += f"""
            <tr style="background: {bg}; font-weight: {weight};">
                <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0;">{row.get("model")}</td>
                {metric_cols}
            </tr>
            """

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Infera Evidence Report - {dataset_name}</title>
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #0f172a; max-width: 900px; margin: 40px auto; padding: 0 20px; }}
        h1, h2, h3 {{ color: #0f172a; }}
        .header {{ border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 30px; }}
        .badge {{ display: inline-block; padding: 4px 10px; background: #e0e7ff; color: #3730a3; border-radius: 12px; font-size: 0.85rem; font-weight: 600; }}
        .metric-card {{ background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 20px; }}
        table {{ width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 0.95rem; }}
        th {{ background: #f1f5f9; text-align: left; padding: 10px 12px; border-bottom: 2px solid #cbd5e1; }}
        @media print {{ body {{ margin: 0; padding: 0; }} }}
    </style>
</head>
<body>
    <div class="header">
        <h1>Infera Automated Data Science Report</h1>
        <p style="color: #64748b; margin: 4px 0;"><strong>Dataset:</strong> {dataset_name} | <strong>Generated:</strong> {now_str} | <span class="badge">Health Score: {health}/100</span></p>
    </div>

    <h2>Executive Overview</h2>
    <div class="metric-card">
        <p><strong>Dataset Shape:</strong> {schema.get("row_count", 0):,} rows &times; {schema.get("column_count", 0)} columns</p>
        <p><strong>Detected Problem:</strong> {problem.get("problem_type", "Exploratory").replace("_", " ").title()} on target <code>{problem.get("target_column") or "None"}</code></p>
        <p><strong>Objective Rationale:</strong> {problem.get("reason", "")}</p>
    </div>

    <h2>Benchmarking & Model Comparison</h2>
    <table>
        <thead>
            <tr>
                <th>Model</th>
                <th>Primary Test Metric</th>
                <th>Secondary Metrics</th>
                <th>Validation Score</th>
            </tr>
        </thead>
        <tbody>
            {table_rows or "<tr><td colspan='4'>Exploratory analysis only.</td></tr>"}
        </tbody>
    </table>

    <h2>Evidence-Backed Insights</h2>
    {insights_html}

    <footer style="margin-top: 50px; border-top: 1px solid #e2e8f0; padding-top: 20px; color: #94a3b8; font-size: 0.85rem; text-align: center;">
        Infera &mdash; Turn data into evidence. Computed via scikit-learn &amp; statsmodels.
    </footer>
</body>
</html>
"""
