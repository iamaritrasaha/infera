"""Comprehensive report generator producing professional Markdown and standalone HTML reports."""

import html
import re
from datetime import UTC, datetime
from pathlib import Path


def _generate_technical_markdown(result_payload: dict) -> str:
    """Generate the existing detailed statistics and diagnostics appendix."""
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


def _finding_markdown(finding: dict) -> str:
    evidence = finding.get("evidence", {})
    lines = [
        f"### {finding.get('title', 'Finding')}",
        f"**Observed:** {finding.get('summary', '')}",
        f"**What it suggests:** {finding.get('interpretation', '')}",
        f"**Evidence strength:** {finding.get('confidence', 'exploratory')} · {finding.get('finding_type', 'observed')}",
        "**Computed evidence:**",
    ]
    if evidence:
        for key, value in evidence.items():
            escaped = str(value).replace("|", r"\|")
            lines.append(f"- **{str(key).replace('_', ' ')}:** {escaped}")
    else:
        lines.append("- No additional numeric evidence was available.")
    lines.append(f"**Limitation:** {finding.get('limitation', 'Interpret this finding in context.')}")
    return "\n".join(lines)


def generate_markdown_report(result_payload: dict) -> str:
    """Generate the insight-first report plus the complete legacy technical record."""
    dataset_name = result_payload.get("dataset_name", "Uploaded Dataset")
    discovery = result_payload.get("insight_discovery", {})
    findings = discovery.get("key_findings", [])
    trends = [item for item in findings if item.get("category") == "time"]
    patterns = [item for item in findings if item.get("category") == "distribution"]
    comparisons = [item for item in findings if item.get("category") == "group"]
    relationships = [item for item in findings if item.get("category") == "relationship"]
    models = result_payload.get("modeling") or {}
    quality = result_payload.get("quality", {})
    missing = quality.get("missing", {})
    duplicates = quality.get("duplicates", {})
    outliers = quality.get("outliers", {})

    def rendered(items: list[dict]) -> str:
        return "\n\n".join(_finding_markdown(item) for item in items) or "No well-supported findings in this category."

    model_line = "No reliable model comparison was produced for this dataset."
    if models:
        model_line = (
            f"The selected model was **{models.get('best_model_name', 'unavailable')}**, "
            f"evaluated on {int(models.get('test_samples', 0)):,} held-out records with "
            f"{int(models.get('cv_folds', 0))} cross-validation folds. These results are specific to this dataset and split."
        )

    technical = _generate_technical_markdown(result_payload)
    detail_start = technical.find("## 3. Data Quality & Integrity Diagnostics")
    appendix = technical[detail_start:] if detail_start >= 0 else technical
    appendix = appendix.replace(
        "## 3. Data Quality & Integrity Diagnostics",
        "### Data Quality & Integrity Diagnostics",
        1,
    )
    appendix = appendix.replace(
        "## 4. Key Bivariate Relationships & Correlations",
        "### Detailed Relationships & Correlations",
        1,
    )
    appendix = appendix.replace("## Descriptive Statistics", "### Descriptive Statistics", 1)
    appendix = appendix.replace("## 6. Machine Learning Model Benchmark", "### Machine Learning Model Benchmark", 1)
    appendix = appendix.replace("## 7. Unsupervised Clustering & Segmentation", "### Unsupervised Clustering & Segmentation", 1)
    appendix = appendix.replace("## 9. Methodology & Scientific Limitations", "### Detailed Methodology & Scientific Limitations", 1)
    appendix = re.sub(r"^## \d+\. Statistical Hypothesis Testing", "### Statistical Hypothesis Testing", appendix, flags=re.MULTILINE)
    appendix = re.sub(r"^## \d+\. Evidence-Backed Insights", "### Additional Computed Notes", appendix, flags=re.MULTILINE)

    return f"""# INFERA DATA SCIENCE EVIDENCE REPORT

**Dataset:** `{dataset_name}`

**Generated:** {datetime.now(UTC).strftime("%Y-%m-%d %H:%M:%S UTC")}
**Prepared by:** Infera · Independently developed by Aritra Saha

## 1. Executive Summary

{discovery.get("dataset_overview", f"Analysis of {dataset_name}.")}

{discovery.get("status", "No supported pattern was identified.")}

## 2. Key Findings

{rendered(findings)}

## 3. Major Trends and Patterns

{rendered(trends + patterns)}

## 4. Important Comparisons

{rendered(comparisons)}

## 5. Relationships

{rendered(relationships)}

## 6. Statistical Evidence

{model_line}

The detailed statistical tests, descriptive summaries, model comparisons, and diagnostic values are included in the appendix. P-values are supporting evidence for specific tests; they are not used alone to rank findings. Observational associations do not establish causes.

## 7. Data Quality

- **Data-quality score:** {result_payload.get("health_score", 0)}/100 (a heuristic, not proof of validity).
- **Missing values:** {int(missing.get("total_missing_cells", 0)):,} cells ({missing.get("overall_missing_percentage", 0)}% of cells); {missing.get("complete_rows_percentage", 100)}% of rows are complete.
- **Duplicate rows:** {int(duplicates.get("duplicate_rows_count", 0)):,} ({duplicates.get("duplicate_rows_percentage", 0)}%).
- **Potential extreme values:** {int(outliers.get("total_iqr_outliers", 0)):,} observations flagged across numeric fields; these may be valid.

## 8. Methodology

All displayed findings are computed in Python from the uploaded dataset using deterministic, bounded analyses. Dates are ordered by parsed timestamps and repeated periods are aggregated. Group and relationship findings include their sample coverage and explicit limitations. Model results are compared with a simple baseline and remain specific to the selected validation split.

## 9. Limitations

This is descriptive analysis unless a finding is explicitly labeled as an association or prediction. It does not identify causal effects. Missingness, irregular sampling, small samples, unmeasured factors, and data collection choices can affect conclusions. Review the detailed statistical assumptions and validation results before making consequential decisions.

## Appendix. Full statistical evidence and diagnostics

{appendix}

---
*Infera: Turn data into evidence. Computed with Python; no paid AI service is used.*
"""


def _render_chart_html(chart: dict[str, object] | None) -> str:
    if not chart:
        return ""
    points = chart.get("points", [])
    if not isinstance(points, list) or not points:
        return ""
    parsed = []
    for point in points:
        if not isinstance(point, dict):
            continue
        try:
            parsed.append((point.get("x", ""), float(point["y"])))
        except (KeyError, TypeError, ValueError):
            continue
    if not parsed:
        return ""

    def number_label(value: float) -> str:
        if abs(value) >= 1_000:
            return f"{value:,.2f}".rstrip("0").rstrip(".")
        return f"{value:.4g}"

    width, height = 680, 250
    left, top, right, bottom = 54, 14, 12, 40
    plot_width, plot_height = width - left - right, height - top - bottom
    values = [value for _, value in parsed]
    ymin, ymax = min(values), max(values)
    if ymax == ymin:
        padding = max(abs(ymax) * 0.1, 1)
    else:
        padding = (ymax - ymin) * 0.12
    kind = str(chart.get("kind", "bar"))
    if kind in {"bar", "histogram"}:
        ymin, ymax = min(0.0, ymin - padding), max(0.0, ymax + max(padding, abs(ymax) * 0.08))
    else:
        ymin, ymax = ymin - padding, ymax + padding
    y_range = ymax - ymin or 1.0

    date_values: list[float] = []
    if kind == "line" and all(
        isinstance(label, str) and re.match(r"^\d{4}-\d{2}-\d{2}T", label)
        for label, _ in parsed
    ):
        try:
            date_values = [
                datetime.fromisoformat(str(label).replace("Z", "+00:00")).timestamp()
                for label, _ in parsed
            ]
        except ValueError:
            date_values = []
    numeric_values: list[float] = []
    if kind == "scatter":
        try:
            numeric_values = [float(label) for label, _ in parsed]
        except (TypeError, ValueError):
            numeric_values = []

    def px(index: int) -> float:
        if len(parsed) == 1:
            return left + plot_width / 2
        if date_values:
            minimum, maximum = min(date_values), max(date_values)
            return left + ((date_values[index] - minimum) / (maximum - minimum or 1)) * plot_width
        if numeric_values:
            minimum, maximum = min(numeric_values), max(numeric_values)
            return left + ((numeric_values[index] - minimum) / (maximum - minimum or 1)) * plot_width
        return left + index * plot_width / (len(parsed) - 1)

    def py(value: float) -> float:
        return top + (ymax - value) * plot_height / y_range

    marks = []
    count_chart = kind in {"bar", "histogram"}
    bar_width = max(4.0, min(34.0, plot_width / len(parsed) * 0.6))
    baseline = py(0.0)
    for index, (label, value) in enumerate(parsed):
        tooltip = html.escape(f"{chart.get('x_label', 'Value')}: {label}; {chart.get('y_label', 'Value')}: {number_label(value)}")
        if count_chart:
            top_y = min(py(value), baseline)
            bar_height = max(1.0, abs(baseline - py(value)))
            marks.append(
                f'<rect x="{px(index) - bar_width / 2:.1f}" y="{top_y:.1f}" width="{bar_width:.1f}" height="{bar_height:.1f}" rx="3" fill="#0891b2"><title>{tooltip}</title></rect>'
            )
        else:
            marks.append(
                f'<circle cx="{px(index):.1f}" cy="{py(value):.1f}" r="3.5" fill="#0891b2"><title>{tooltip}</title></circle>'
            )
    if kind == "line" and len(parsed) > 1:
        path = " ".join(
            f"{'M' if index == 0 else 'L'}{px(index):.1f},{py(value):.1f}"
            for index, (_, value) in enumerate(parsed)
        )
        marks.insert(0, f'<path d="{path}" fill="none" stroke="#0891b2" stroke-width="2.5"/>')
    title = html.escape(str(chart.get("title", "Computed chart")))
    x_label = html.escape(str(chart.get("x_label", "")))
    y_label = html.escape(str(chart.get("y_label", "")))
    ticks = []
    for index in range(5):
        value = ymin + y_range * (4 - index) / 4
        position = py(value)
        ticks.append(
            f'<line x1="{left}" x2="{width - right}" y1="{position:.1f}" y2="{position:.1f}" stroke="#e2e8f0" stroke-dasharray="3 4"/><text x="{left - 7}" y="{position + 4:.1f}" text-anchor="end" fill="#64748b" font-size="10">{number_label(value)}</text>'
        )
    x_ticks = []
    tick_count = min(4, len(parsed) - 1)
    tick_indices = sorted({round(i * (len(parsed) - 1) / tick_count) for i in range(tick_count + 1)}) if tick_count else [0]
    for index in tick_indices:
        label = str(parsed[index][0])
        if date_values:
            try:
                label = datetime.fromisoformat(label.replace("Z", "+00:00")).strftime("%b %Y")
            except ValueError:
                pass
        label = label if len(label) <= 16 else f"{label[:15]}…"
        x_ticks.append(
            f'<text x="{px(index):.1f}" y="{height-bottom+16}" text-anchor="middle" fill="#64748b" font-size="9">{html.escape(label)}</text>'
        )
    return f"""<figure style="margin:1rem 0;padding:0.75rem;border:1px solid #e2e8f0;border-radius:10px;background:#fff">
      <figcaption style="font-weight:600;font-size:.9rem;margin-bottom:.35rem">{title}</figcaption>
      <svg viewBox="0 0 {width} {height}" role="img" aria-label="{title}. Horizontal axis: {x_label}. Vertical axis: {y_label}.">
        {''.join(ticks)}<line x1="{left}" x2="{left}" y1="{top}" y2="{height-bottom}" stroke="#64748b"/><line x1="{left}" x2="{width-right}" y1="{height-bottom}" y2="{height-bottom}" stroke="#64748b"/>
        {''.join(marks)}{''.join(x_ticks)}
        <text x="{left+plot_width/2:.1f}" y="{height-5}" text-anchor="middle" fill="#475569" font-size="11">{x_label}</text>
        <text x="13" y="{top+plot_height/2:.1f}" transform="rotate(-90 13 {top+plot_height/2:.1f})" text-anchor="middle" fill="#475569" font-size="11">{y_label}</text>
      </svg>
    </figure>"""


def generate_html_report(result_payload: dict) -> str:
    """Generates a standalone, beautifully styled HTML report ready for printing or viewing."""
    dataset_name = html.escape(str(result_payload.get("dataset_name", "Uploaded Dataset")))
    health = int(result_payload.get("health_score", 100))
    discovery = result_payload.get("insight_discovery", {})
    models = result_payload.get("modeling", {})
    findings = discovery.get("key_findings", [])

    now_str = datetime.now(UTC).strftime("%Y-%m-%d %H:%M:%S UTC")

    findings_html = ""
    for finding in findings:
        title = html.escape(str(finding.get("title", "")))
        summary = html.escape(str(finding.get("summary", "")))
        interpretation = html.escape(str(finding.get("interpretation", "")))
        limitation = html.escape(str(finding.get("limitation", "")))
        evidence = finding.get("evidence", {})
        evidence_html = "".join(
            f"<li><strong>{html.escape(str(key).replace('_', ' '))}:</strong> {html.escape(str(value))}</li>"
            for key, value in evidence.items()
        )
        findings_html += f"""
        <article style="margin-bottom:1.25rem;padding:1rem 1.1rem;border:1px solid #dbeafe;border-radius:12px;background:#f8fafc">
          <p style="margin:0 0 .35rem;color:#0e7490;font-size:.72rem;text-transform:uppercase;font-weight:700;letter-spacing:.08em">{html.escape(str(finding.get('category', 'finding')))} · {html.escape(str(finding.get('confidence', 'exploratory')))} evidence</p>
          <h3 style="margin:.25rem 0;color:#0f172a;font-size:1.15rem">{title}</h3>
          <p style="margin:.35rem 0;color:#334155">{summary}</p>
          <p style="margin:.35rem 0;color:#475569;font-size:.9rem">{interpretation}</p>
          {_render_chart_html(finding.get('chart'))}
          <details><summary style="cursor:pointer;color:#334155;font-size:.85rem">Computed evidence and limitation</summary>
            <ul style="line-height:1.7;color:#334155">{evidence_html}</ul>
            <p style="color:#64748b;font-size:.85rem"><strong>Limitation:</strong> {limitation}</p>
          </details>
        </article>
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

    <h2>Executive Summary</h2>
    <div class="metric-card">
        <p>{html.escape(str(discovery.get("dataset_overview", "Evidence computed from the uploaded dataset.")))}</p>
        <p><strong>{html.escape(str(discovery.get("status", "No strong finding was identified.")))}</strong></p>
    </div>

    <h2>Key Findings</h2>
    {findings_html or "<p>No well-supported pattern was identified for this dataset.</p>"}

    <details style="margin:1.5rem 0">
      <summary style="cursor:pointer;font-weight:600">Statistical and model comparison tables</summary>
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
    </details>

    <details style="margin:1.5rem 0">
      <summary style="cursor:pointer;font-weight:600">Open the full statistical report and limitations</summary>
      <pre style="white-space: pre-wrap; overflow-wrap: anywhere; font: inherit; padding: 16px; background: #f8fafc;">{html.escape(generate_markdown_report(result_payload))}</pre>
    </details>

    <footer style="margin-top: 50px; border-top: 1px solid #e2e8f0; padding-top: 20px; color: #94a3b8; font-size: 0.85rem; text-align: center;">
        Infera : Turn data into evidence. Computed via Python. Created and maintained independently by Aritra Saha. MIT License.
    </footer>
</body>
</html>
"""
