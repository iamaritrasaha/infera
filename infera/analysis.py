"""Master analysis coordinator.

This module connects the components:
data loading -> data profiling -> descriptive statistics -> correlation -> regression -> report generation.

Traceable execution order:
1. Inspect dataset schema and quality (data_loader.py)
2. Compute descriptive statistics for all columns (statistics.py)
3. Compute Pearson and Spearman correlations (correlation.py)
4. Train and compare regression models if a numeric target is present (regression.py)
5. Generate Markdown and HTML reports (reporting.py)
"""

from typing import Any

import pandas as pd

from infera.correlation import compute_correlations
from infera.data_loader import (
    calculate_health_score,
    compute_quality_profile,
    get_dataset_schema,
    preview_records,
)
from infera.exploration import explore_dataframe
from infera.models import ExploreRequest
from infera.regression import train_regression_models
from infera.reporting import generate_html_report, generate_markdown_report
from infera.statistics import compute_descriptive_statistics


def run_full_analysis(
    df: pd.DataFrame,
    dataset_name: str = "Dataset",
    dataset_id: str = "custom",
    user_target: str | None = None,
    focus: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Execute complete analysis pipeline across a DataFrame.

    Args:
        df: The pandas DataFrame to analyze.
        dataset_name: Display name for reports.
        dataset_id: Unique identifier for tracking results.
        user_target: Optional target column for regression modeling.

    Returns:
        Dictionary conforming to AnalysisResponse schema.
    """
    # -----------------------------------------------------------------------
    # Step 1: Schema Inspection & Data Quality Profiling
    # -----------------------------------------------------------------------
    if user_target and user_target not in df:
        raise ValueError(f"Target column {user_target!r} does not exist.")
    focus = focus or {}
    for key in ("metric_column", "date_column", "group_column"):
        if focus.get(key) and focus[key] not in df:
            raise ValueError(f"Unknown {key}: {focus[key]}")
    schema_dict = get_dataset_schema(df)
    quality_profile = compute_quality_profile(df)
    health_score = calculate_health_score(df)

    numerical_cols = schema_dict["numerical_columns"]
    categorical_cols = schema_dict["categorical_columns"]

    # -----------------------------------------------------------------------
    # Step 2: Descriptive Statistics
    # -----------------------------------------------------------------------
    stats = compute_descriptive_statistics(
        df,
        numerical_columns=numerical_cols,
        categorical_columns=categorical_cols,
    )

    # -----------------------------------------------------------------------
    # Step 3: Correlation Analysis
    # -----------------------------------------------------------------------
    # Exclude identifier columns from correlation analysis
    clean_numeric_cols = [
        c
        for c in numerical_cols
        if c not in schema_dict["id_columns"] and c not in schema_dict["constant_columns"]
    ]
    correlations = compute_correlations(df, clean_numeric_cols)

    # -----------------------------------------------------------------------
    # Step 4: Problem Detection & Target Selection
    # -----------------------------------------------------------------------
    target_column = user_target
    if not target_column:
        potential_targets = schema_dict["potential_targets"]
        if potential_targets:
            target_column = potential_targets[0]["column"]

    problem_type = "exploratory"
    if target_column and target_column in df.columns:
        if pd.api.types.is_numeric_dtype(df[target_column]) and df[target_column].nunique() > 2:
            problem_type = "regression"
        else:
            problem_type = (
                "binary_classification"
                if df[target_column].nunique() == 2
                else "multiclass_classification"
            )

    problem_detection: dict[str, Any] = {
        "problem_type": problem_type,
        "target_column": target_column,
        "confidence": "high" if user_target else "moderate",
        "reason": f"Target '{target_column}' is numeric with variance"
        if problem_type == "regression"
        else "Exploratory analysis without predictive target",
        "target_details": {"unique_values": int(df[target_column].nunique())}
        if target_column and target_column in df.columns
        else {},
        "alternative_targets": schema_dict["potential_targets"],
    }

    # -----------------------------------------------------------------------
    # Step 5: Predictive Modeling (Regression)
    # -----------------------------------------------------------------------
    modeling_result = None
    feature_cols: list[str] = []
    can_run_ml = False
    skipped = [
        {
            "name": name,
            "category": "analysis",
            "reason": "Removed by the beginner refactor; not implemented in this version.",
        }
        for name in (
            "Classification",
            "Clustering",
            "PCA",
            "Stationarity tests",
            "Hypothesis tests",
        )
    ]

    if problem_type == "regression" and target_column:
        feature_cols = [c for c in clean_numeric_cols if c != target_column]
        if len(feature_cols) > 0 and len(df) >= 10:
            try:
                mod_res = train_regression_models(df, target_column, feature_cols)
                modeling_result = mod_res.model_dump()
                can_run_ml = True
            except ValueError as err:
                skipped.append({"name": "Regression", "category": "ml", "reason": str(err)})

    if (
        problem_type == "regression"
        and not can_run_ml
        and not any(s["name"] == "Regression" for s in skipped)
    ):
        skipped.append(
            {
                "name": "Regression",
                "category": "ml",
                "reason": "Insufficient sample size or predictors: requires at least 10 observed targets and a varying numeric predictor.",
            }
        )

    plan: dict[str, Any] = {
        "problem_type": problem_type,
        "target_column": target_column,
        "planned_analyses": [
            {
                "name": "Data Profiling",
                "category": "profiling",
                "description": "Audit data types, missing values, duplicates, and outliers",
            },
            {
                "name": "Descriptive Statistics",
                "category": "statistics",
                "description": "Compute mean, median, IQR, skewness, and histograms",
            },
            {
                "name": "Correlation Matrix",
                "category": "correlation",
                "description": "Compute Pearson and Spearman correlation pairs",
            },
        ],
        "skipped_analyses": skipped,
        "feature_columns": feature_cols,
        "can_run_ml": can_run_ml,
        "summary": f"Analyzed {len(df)} rows across {len(df.columns)} columns."
        + (f" Trained regression models on '{target_column}'." if can_run_ml else ""),
    }

    if can_run_ml:
        plan["planned_analyses"].append(
            {
                "name": "Regression Modeling",
                "category": "ml",
                "description": "Benchmark Linear Regression, Ridge, and Random Forest",
            }
        )

    # -----------------------------------------------------------------------
    # Step 6: Generate Summary Insights
    # -----------------------------------------------------------------------
    insights: list[dict[str, Any]] = []

    # Quality insight
    insights.append(
        {
            "id": "quality_insight",
            "category": "data_quality",
            "title": "Dataset Health & Quality",
            "summary": f"Health score is {health_score}/100. {quality_profile.missing.total_missing_cells} missing cells detected.",
            "plain_english": quality_profile.missing.recommendation,
            "confidence": "high",
            "evidence": {
                "health_score": health_score,
                "missing_cells": quality_profile.missing.total_missing_cells,
            },
            "calculation_details": "Penalized based on proportion of missing values and duplicate rows.",
        }
    )

    # Correlation insight
    if correlations.top_correlations:
        strongest = correlations.top_correlations[0]
        insights.append(
            {
                "id": "correlation_insight",
                "category": "correlation",
                "title": f"Strong Association: {strongest.feature_a} and {strongest.feature_b}",
                "summary": strongest.plain_english,
                "plain_english": strongest.plain_english,
                "confidence": "high" if strongest.is_statistically_significant else "moderate",
                "evidence": {
                    "pearson_r": strongest.pearson_r,
                    "p_value": strongest.pearson_p_value,
                },
                "calculation_details": f"Pearson correlation r = {strongest.pearson_r:.2f}.",
            }
        )

    # Modeling insight
    if modeling_result:
        insights.append(
            {
                "id": "modeling_insight",
                "category": "machine_learning",
                "title": f"Predictive Champion: {modeling_result['best_model_name']}",
                "summary": modeling_result["insight"],
                "plain_english": modeling_result["insight"],
                "confidence": "high",
                "evidence": {
                    "best_model": modeling_result["best_model_name"],
                    "r2": next(
                        m["r2_test"] for m in modeling_result["models"] if m["is_best_model"]
                    ),
                },
                "calculation_details": "Evaluated with 20% holdout test split and 5-fold cross-validation.",
            }
        )

    # Frontend insight_discovery wrapper
    insight_discovery: dict[str, Any] = {
        "dataset_overview": f"{dataset_name} contains {len(df):,} observations across {len(df.columns)} columns.",
        "status": "ready",
        "selected_focus": {
            "metric_column": focus.get("metric_column")
            or (clean_numeric_cols[0] if clean_numeric_cols else None),
            "date_column": focus.get("date_column") or schema_dict["datetime_columns"][0]
            if schema_dict["datetime_columns"]
            else None,
            "group_column": focus.get("group_column")
            or (categorical_cols[0] if categorical_cols else None),
            "question": focus.get("question", "automatic"),
        },
        "options": {
            "metric_columns": clean_numeric_cols,
            "date_columns": schema_dict["datetime_columns"],
            "group_columns": categorical_cols,
        },
        "important_metrics": [
            {
                "label": f"Typical {col}",
                "value": f"{df[col].mean():.2f}",
                "detail": f"Mean value of {col}",
            }
            for col in sorted(
                clean_numeric_cols, key=lambda c: c != (focus.get("metric_column") or target_column)
            )[:3]
        ],
        "key_findings": [
            {
                "id": f"finding_{idx}",
                "category": {"correlation": "relationship", "machine_learning": "model"}.get(
                    i["category"], i["category"]
                ),
                "finding_type": "association" if i["category"] == "correlation" else "observed",
                "title": i["title"],
                "summary": i["summary"],
                "interpretation": i["plain_english"],
                "limitation": "Statistical models approximate patterns and do not prove underlying causation.",
                "confidence": i["confidence"],
                "evidence": i["evidence"],
                "chart": None,
            }
            for idx, i in enumerate(insights)
        ],
        "suggested_questions": [
            f"What factors most strongly predict {target_column}?"
            if target_column
            else "Which features have the strongest correlation?",
            "Are there any data quality issues that should be addressed before modeling?",
        ],
    }

    # Reuse the explorer for focus controls instead of silently ignoring them.
    selected = insight_discovery["selected_focus"]
    metric = focus.get("metric_column") or target_column or selected["metric_column"]
    for mode, column, category in (
        ("group", selected["group_column"], "group"),
        ("trend", selected["date_column"], "time"),
    ):
        if not metric or metric not in clean_numeric_cols or not column:
            continue
        try:
            explored = explore_dataframe(
                df,
                ExploreRequest(
                    dataset_id=dataset_id,
                    mode=mode,
                    metric_column=metric,
                    group_column=column if mode == "group" else None,
                    time_column=column if mode == "trend" else None,
                ),
            )
        except ValueError:
            continue
        if explored.get("chart"):
            insight_discovery["key_findings"].insert(
                0,
                {
                    "id": f"focus_{mode}",
                    "category": category,
                    "finding_type": "observed",
                    "title": f"Recorded {metric} differs across {column}"
                    if mode == "group"
                    else f"Recorded {metric} over {column}",
                    "summary": explored["interpretation"],
                    "interpretation": "Descriptive comparison of observed data.",
                    "limitation": "Association does not establish causation; observations may be dependent.",
                    "confidence": "exploratory",
                    "evidence": {
                        "metric_column": metric,
                        "group_column": selected["group_column"],
                        "datetime_column": selected["date_column"],
                    },
                    "chart": explored["chart"],
                },
            )
    if selected["question"] == "groups":
        insight_discovery["key_findings"].sort(key=lambda f: f["category"] != "group")
    insight_discovery["key_findings"] = insight_discovery["key_findings"][:5]
    if metric:
        insight_discovery["suggested_questions"] = [f"Which fields correlate with `{metric}`?"]
        if selected["group_column"]:
            insight_discovery["suggested_questions"].append(
                f"How does `{metric}` vary across `{selected['group_column']}`?"
            )
        if selected["date_column"]:
            insight_discovery["suggested_questions"].append(
                f"How does `{metric}` evolve over the observed dates in `{selected['date_column']}`?"
            )
    insight_discovery["goal"] = focus.get("goal")

    # -----------------------------------------------------------------------
    # Step 7: Assemble Final Result and Generate Reports
    # -----------------------------------------------------------------------
    payload: dict[str, Any] = {
        "dataset_id": dataset_id,
        "dataset_name": dataset_name,
        "health_score": health_score,
        "schema": schema_dict,
        "quality": quality_profile.model_dump(),
        "descriptive_statistics": stats.model_dump(),
        "correlations": correlations.model_dump(),
        "hypothesis_tests": [],
        "problem_detection": problem_detection,
        "plan": plan,
        "modeling": modeling_result,
        "clustering": None,
        "pca": None,
        "timeseries": None,
        "insights": insights,
        "insight_discovery": insight_discovery,
        "preview_rows": preview_records(df),
    }

    payload["reports"] = {
        "markdown": generate_markdown_report(payload),
        "html": generate_html_report(payload),
    }

    return payload
