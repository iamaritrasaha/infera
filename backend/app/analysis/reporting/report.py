"""Comprehensive report generator producing professional Markdown and standalone HTML reports."""

import html
from datetime import UTC, datetime
from pathlib import Path


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

    now_str = datetime.now(UTC).strftime("%Y-%m-%d %H:%M:%S UTC")

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
| **Numerical** | {len(schema.get("numerical_columns", []))} | {", ".join(schema.get("numerical_columns", [])) or "None"} |
| **Categorical** | {len(schema.get("categorical_columns", []))} | {", ".join(schema.get("categorical_columns", [])) or "None"} |
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
        for c in top_corrs:
            md += f"| `{c.get('feature_a')}` | `{c.get('feature_b')}` | **{c.get('pearson_r'):+.3f}** | {c.get('pearson_p_value'):.4e} | {c.get('strength', '').replace('_', ' ').capitalize()} |\n"
    else:
        md += "*No admissible pairwise numerical correlations could be calculated.*\n"

    md += "\n## Descriptive Statistics\n\n"
    numerical = result_payload.get("descriptive_statistics", {}).get("numerical", [])
    if numerical:
        md += "| Column | Valid count | Mean | Median | Sample std | Minimum | Maximum |\n"
        md += "| :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n"
        for distribution in numerical:
            values = [distribution.get(key) for key in ["column", "count", "mean", "median", "std", "min", "max"]]
            md += "| " + " | ".join("Unavailable" if value is None else str(value).replace("|", "\\|") for value in values) + " |\n"
    else:
        md += "No numerical distributions are available.\n"

    # Hypothesis Tests
    if hypothesis:
        md += "\n---\n\n## 5. Statistical Hypothesis Testing\n\n"
        for t in hypothesis:
            md += f"### {t.get('test_name')} (`{t.get('feature_a')}` vs `{t.get('feature_b')}`)\n"
            md += f"- **Null Hypothesis ($H_0$):** {t.get('null_hypothesis')}\n"
            md += f"- **Alternative Hypothesis ($H_1$):** {t.get('alt_hypothesis')}\n"
            md += f"- **Test Statistic:** {t.get('statistic_name')} = `{t.get('statistic_value')}` (p-value = `{t.get('p_value'):.4e}`, alpha = 0.05)\n"
            md += f"- **Empirical Decision:** **{'Reject $H_0$ (Statistically Significant)' if t.get('is_rejected') else 'Fail to Reject $H_0$ (Inconclusive)'}**\n"
            md += f"- **Statistical Interpretation:** {t.get('interpretation')}\n"
            md += f"- **Assumptions and limitations:** {t.get('assumptions_note')}\n\n"

    # Machine Learning Benchmarking
    if models and models.get("summary_table"):
        prob_title = problem.get("problem_type", "supervised").replace("_", " ").title()
        md += f"""---

## 6. Machine Learning Model Benchmark ({prob_title})

**Target Feature:** `{models.get("target_column")}`
**Validation Strategy:** Training observations: {models.get("train_samples")}; holdout observations: {models.get("test_samples")}. Training CV folds: {models.get("cv_folds", 0)}.
**Selected Model:** **{models.get("best_model_name")}**

### Model Performance Comparison

"""
        if "regression" in problem.get("problem_type", ""):
            md += (
                "| Model Architecture | Test R² | Test RMSE | Test MAE | Training CV R² | Status |\n"
            )
            md += "| :--- | :--- | :--- | :--- | :--- | :--- |\n"
            for row in models.get("summary_table", []):
                best_badge = "**Selected**" if row.get("is_best") else "Evaluated"
                md += f"| {row.get('model')} | **{row.get('r2')}** | {row.get('rmse')} | {row.get('mae')} | {row.get('cv_r2')} | {best_badge} |\n"
        else:
            md += "| Model Architecture | Test Accuracy | Macro F1 | Macro Precision | Macro Recall | ROC-AUC | Training CV F1 | Status |\n"
            md += "| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n"
            for row in models.get("summary_table", []):
                best_badge = "**Selected**" if row.get("is_best") else "Evaluated"
                md += f"| {row.get('model')} | **{row.get('accuracy')}** | {row.get('f1_macro')} | {row.get('precision')} | {row.get('recall')} | {row.get('roc_auc')} | {row.get('cv_f1')} | {best_badge} |\n"

        if "classification" in problem.get("problem_type", ""):
            md += "\n### Confusion Matrices\n"
            for model in models.get("models", []):
                md += f"\n**{model['display_name']}**; labels: `{model['confusion_matrix_labels']}`. Rows are actual classes and columns are predictions.\n"
                for row in model["confusion_matrix"]:
                    md += f"\n`{row}`\n"
        md += f"\n> **Validation Insight:** {models.get('insight', '')}\n"
        md += f"\nSelection: {models.get('selection_method', 'Unavailable')}; training CV folds: {models.get('cv_folds', 0)}.\n"
        md += f"\nPreparation and resource limits: `{models.get('preparation', {})}`\n"
        if models.get('failed_models'):
            md += f"\nUnavailable models: {', '.join(models['failed_models'])}. No metrics were substituted.\n"

    # Clustering / Segmentation
    if clustering:
        md += f"""---

## 7. Unsupervised Clustering & Segmentation

- **Selected cluster count (K-Means):** k = {clustering.get("optimal_k")} (Silhouette Score = {clustering.get("kmeans_result", {}).get("silhouette", "N/A")})
- **Summary:** {clustering.get("summary_insight", "")}
"""

    pca = result_payload.get("pca")
    timeseries = result_payload.get("timeseries")
    if pca:
        md += f"\n## Principal Component Analysis\n\n{pca['summary']}\n\nObservations used: {pca['sample_count']}; incomplete rows excluded: {pca['excluded_missing_rows']}.\n"
    if timeseries:
        md += f"\n## Time-series Diagnostics\n\n{timeseries['stationarity_interpretation']}\n"
        md += f"\nObservations: {timeseries['total_observations']}; ADF statistic: {timeseries['adf_statistic']}; p-value: {timeseries['adf_p_value']}.\n"
        md += f"\nLag autocorrelations: `{timeseries['lag_autocorrelations']}`\n"
    if clustering:
        md += f"\n{clustering.get('sampling_note', '')}\n"
    md += "\n## Unavailable Analyses\n\n"
    skipped_analyses = result_payload.get("plan", {}).get("skipped_analyses", [])
    if not skipped_analyses:
        md += "None recorded for this run.\n"
    for skipped in skipped_analyses:
        md += f"- {skipped['name']}: {skipped['reason']}\n"

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
4. **Exploratory Tests:** P-values are unadjusted for multiple comparisons. Independence and study design require review. The health score describes a quality heuristic, not proof that the data are valid.
5. **Model Boundaries:** Linear models assume additive relationships; tree ensembles capture non-linear interactions without assuming Gaussianity.

---
*Report generated by Infera. Created and maintained independently by Aritra Saha. MIT License. Turn data into evidence.*
"""
    return md


def generate_html_report(result_payload: dict) -> str:
    """Generates a standalone, beautifully styled HTML report ready for printing or viewing."""
    dataset_name = html.escape(str(result_payload.get("dataset_name", "Uploaded Dataset")))
    health = int(result_payload.get("health_score", 100))
    schema = result_payload.get("schema", {})
    problem = result_payload.get("problem_detection", {})
    models = result_payload.get("modeling", {})
    insights = result_payload.get("insights", [])

    now_str = datetime.now(UTC).strftime("%Y-%m-%d %H:%M:%S UTC")

    insights_html = ""
    for ins in insights:
        title = html.escape(str(ins.get("title", "")))
        plain_english = html.escape(str(ins.get("plain_english", "")))
        calc_details = html.escape(str(ins.get("calculation_details", "")))
        insights_html += f"""
        <div style="margin-bottom: 1.5rem; padding: 1rem; border-left: 4px solid #2563eb; background: #f8fafc; border-radius: 4px;">
            <h4 style="margin: 0 0 0.5rem 0; color: #1e293b; font-size: 1.05rem;">{title}</h4>
            <p style="margin: 0 0 0.5rem 0; color: #475569; line-height: 1.5;">{plain_english}</p>
            <small style="color: #64748b; font-family: monospace;">Evidence: {calc_details}</small>
        </div>
        """

    table_rows = ""
    metric_headers = []
    if models and models.get("summary_table"):
        metric_headers = [k for k in models["summary_table"][0] if k not in ["is_best", "model"]]
        for row in models.get("summary_table", []):
            is_best = row.get("is_best", False)
            bg = "#eff6ff" if is_best else "#ffffff"
            weight = "bold" if is_best else "normal"
            model_name = html.escape(str(row.get("model", "")))
            metric_cols = "".join(
                [
                    f"<td style='padding: 8px 12px; border-bottom: 1px solid #e2e8f0;'>{html.escape(str(v))}</td>"
                    for k, v in row.items()
                    if k not in ["is_best", "model"]
                ]
            )
            table_rows += f"""
            <tr style="background: {bg}; font-weight: {weight};">
                <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0;">{model_name}</td>
                {metric_cols}
            </tr>
            """

    target_col = html.escape(str(problem.get("target_column") or "None"))
    reason_text = html.escape(str(problem.get("reason", "")))
    problem_type_str = html.escape(
        str(problem.get("problem_type", "Exploratory")).replace("_", " ").title()
    )

    icon_svg = Path(__file__).with_name("infera-icon.svg").read_text()
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
        <h1 style="display: flex; align-items: center; gap: 12px;">{icon_svg}Infera Automated Data Science Report</h1>
        <p style="color: #64748b; margin: 4px 0;"><strong>Dataset:</strong> {dataset_name} | <strong>Generated:</strong> {now_str} | <span class="badge">Health Score: {health}/100</span></p>
    </div>

    <h2>Executive Overview</h2>
    <div class="metric-card">
        <p><strong>Dataset Shape:</strong> {schema.get("row_count", 0):,} rows &times; {schema.get("column_count", 0)} columns</p>
        <p><strong>Detected Problem:</strong> {problem_type_str} on target <code>{target_col}</code></p>
        <p><strong>Objective Rationale:</strong> {reason_text}</p>
    </div>

    <h2>Benchmarking & Model Comparison</h2>
    <table>
        <thead>
            <tr>
                <th>Model</th>
                {"".join(f"<th>{html.escape(k.replace('_', ' ').upper())}</th>" for k in metric_headers)}
            </tr>
        </thead>
        <tbody>
            {table_rows or "<tr><td colspan='4'>Exploratory analysis only.</td></tr>"}
        </tbody>
    </table>

    <h2>Evidence-Backed Insights</h2>
    {insights_html}

    <h2>Complete Evidence and Methodology</h2>
    <pre style="white-space: pre-wrap; overflow-wrap: anywhere; font: inherit; padding: 16px; background: #f8fafc;">{html.escape(generate_markdown_report(result_payload))}</pre>

    <footer style="margin-top: 50px; border-top: 1px solid #e2e8f0; padding-top: 20px; color: #94a3b8; font-size: 0.85rem; text-align: center;">
        Infera : Turn data into evidence. Computed via Python. Created and maintained independently by Aritra Saha. MIT License.
    </footer>
</body>
</html>
"""
