"""Master analysis coordinator.

This module connects all analytical steps into a cohesive pipeline:
1. Schema & Quality Profiling (data_loader.py)
2. Descriptive Statistics (statistics.py)
3. Correlations (correlation.py)
4. Predictive Modeling / Regression (regression.py)
5. Exploratory Insights & Discovery (exploration.py)
6. Executive Report Generation (reporting.py)
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

SKIPPED_CAPABILITIES = [
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


def _detect_problem(
    df: pd.DataFrame, user_target: str | None, schema: dict[str, Any]
) -> tuple[str | None, str, dict[str, Any]]:
    """Determine predictive problem type and target column."""
    target = user_target
    if not target and schema["potential_targets"]:
        target = schema["potential_targets"][0]["column"]

    problem_type = "exploratory"
    if target and target in df.columns:
        if pd.api.types.is_numeric_dtype(df[target]) and df[target].nunique() > 2:
            problem_type = "regression"
        else:
            problem_type = (
                "binary_classification"
                if df[target].nunique() == 2
                else "multiclass_classification"
            )

    details = (
        {"unique_values": int(df[target].nunique())} if target and target in df.columns else {}
    )
    detection = {
        "problem_type": problem_type,
        "target_column": target,
        "confidence": "high" if user_target else "moderate",
        "reason": f"Target '{target}' is numeric with variance"
        if problem_type == "regression"
        else "Exploratory analysis without predictive target",
        "target_details": details,
        "alternative_targets": schema["potential_targets"],
    }
    return target, problem_type, detection


def _run_modeling_and_plan(
    df: pd.DataFrame,
    target_column: str | None,
    problem_type: str,
    feature_cols: list[str],
) -> tuple[dict[str, Any] | None, dict[str, Any]]:
    """Train regression models if applicable and compile the execution plan."""
    modeling_result = None
    can_run_ml = False
    skipped = list(SKIPPED_CAPABILITIES)

    if problem_type == "regression" and target_column:
        features = [c for c in feature_cols if c != target_column]
        if len(features) > 0 and len(df) >= 10:
            try:
                mod_res = train_regression_models(df, target_column, features)
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

    planned = [
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
    ]
    if can_run_ml:
        planned.append(
            {
                "name": "Regression Modeling",
                "category": "ml",
                "description": "Benchmark Linear Regression, Ridge, and Random Forest",
            }
        )

    summary = f"Analyzed {len(df)} rows across {len(df.columns)} columns."
    if can_run_ml:
        summary += f" Trained regression models on '{target_column}'."

    plan = {
        "problem_type": problem_type,
        "target_column": target_column,
        "planned_analyses": planned,
        "skipped_analyses": skipped,
        "feature_columns": [c for c in feature_cols if c != target_column],
        "can_run_ml": can_run_ml,
        "summary": summary,
    }
    return modeling_result, plan


def _build_insights_and_discovery(
    df: pd.DataFrame,
    dataset_id: str,
    dataset_name: str,
    health_score: int,
    quality: Any,
    correlations: Any,
    modeling: dict[str, Any] | None,
    focus: dict[str, Any],
    clean_numeric: list[str],
    schema: dict[str, Any],
    target_column: str | None,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """Extract primary insights and compile discovery options for the frontend."""
    insights: list[dict[str, Any]] = [
        {
            "id": "quality_insight",
            "category": "data_quality",
            "title": "Dataset Health & Quality",
            "summary": f"Health score is {health_score}/100. {quality.missing.total_missing_cells} missing cells detected.",
            "plain_english": quality.missing.recommendation,
            "confidence": "high",
            "evidence": {
                "health_score": health_score,
                "missing_cells": quality.missing.total_missing_cells,
            },
            "calculation_details": "Penalized based on proportion of missing values and duplicate rows.",
        }
    ]

    if correlations.top_correlations:
        top = correlations.top_correlations[0]
        insights.append(
            {
                "id": "correlation_insight",
                "category": "correlation",
                "title": f"Strong Association: {top.feature_a} and {top.feature_b}",
                "summary": top.plain_english,
                "plain_english": top.plain_english,
                "confidence": "high" if top.is_statistically_significant else "moderate",
                "evidence": {"pearson_r": top.pearson_r, "p_value": top.pearson_p_value},
                "calculation_details": f"Pearson correlation r = {top.pearson_r:.2f}.",
            }
        )

    if modeling:
        best_r2 = next(m["r2_test"] for m in modeling["models"] if m["is_best_model"])
        insights.append(
            {
                "id": "modeling_insight",
                "category": "machine_learning",
                "title": f"Predictive Champion: {modeling['best_model_name']}",
                "summary": modeling["insight"],
                "plain_english": modeling["insight"],
                "confidence": "high",
                "evidence": {"best_model": modeling["best_model_name"], "r2": best_r2},
                "calculation_details": "Evaluated with 20% holdout test split and 5-fold cross-validation.",
            }
        )

    categorical_cols = schema["categorical_columns"]
    datetime_cols = schema["datetime_columns"]

    selected_focus = {
        "metric_column": focus.get("metric_column")
        or (clean_numeric[0] if clean_numeric else None),
        "date_column": focus.get("date_column") or (datetime_cols[0] if datetime_cols else None),
        "group_column": focus.get("group_column")
        or (categorical_cols[0] if categorical_cols else None),
        "question": focus.get("question", "automatic"),
    }

    important_cols = sorted(
        clean_numeric, key=lambda c: c != (focus.get("metric_column") or target_column)
    )[:3]
    important_metrics = [
        {"label": f"Typical {c}", "value": f"{df[c].mean():.2f}", "detail": f"Mean value of {c}"}
        for c in important_cols
    ]

    key_findings = [
        {
            "id": f"finding_{idx}",
            "category": {"correlation": "relationship", "machine_learning": "model"}.get(
                item["category"], item["category"]
            ),
            "finding_type": "association" if item["category"] == "correlation" else "observed",
            "title": item["title"],
            "summary": item["summary"],
            "interpretation": item["plain_english"],
            "limitation": "Statistical models approximate patterns and do not prove underlying causation.",
            "confidence": item["confidence"],
            "evidence": item["evidence"],
            "chart": None,
        }
        for idx, item in enumerate(insights)
    ]

    metric = focus.get("metric_column") or target_column or selected_focus["metric_column"]
    for mode, col, cat in (
        ("group", selected_focus["group_column"], "group"),
        ("trend", selected_focus["date_column"], "time"),
    ):
        if not metric or metric not in clean_numeric or not col:
            continue
        try:
            req = ExploreRequest(
                dataset_id=dataset_id,
                mode=mode,
                metric_column=metric,
                group_column=col if mode == "group" else None,
                time_column=col if mode == "trend" else None,
            )
            explored = explore_dataframe(df, req)
        except ValueError:
            continue
        if explored.get("chart"):
            title = (
                f"Recorded {metric} differs across {col}"
                if mode == "group"
                else f"Recorded {metric} over {col}"
            )
            key_findings.insert(
                0,
                {
                    "id": f"focus_{mode}",
                    "category": cat,
                    "finding_type": "observed",
                    "title": title,
                    "summary": explored["interpretation"],
                    "interpretation": "Descriptive comparison of observed data.",
                    "limitation": "Association does not establish causation; observations may be dependent.",
                    "confidence": "exploratory",
                    "evidence": {
                        "metric_column": metric,
                        "group_column": selected_focus["group_column"],
                        "datetime_column": selected_focus["date_column"],
                    },
                    "chart": explored["chart"],
                },
            )

    if selected_focus["question"] == "groups":
        key_findings.sort(key=lambda f: f["category"] != "group")
    key_findings = key_findings[:5]

    questions = [
        f"What factors most strongly predict {target_column}?"
        if target_column
        else "Which features have the strongest correlation?",
        "Are there any data quality issues that should be addressed before modeling?",
    ]
    if metric:
        questions = [f"Which fields correlate with `{metric}`?"]
        if selected_focus["group_column"]:
            questions.append(f"How does `{metric}` vary across `{selected_focus['group_column']}`?")
        if selected_focus["date_column"]:
            questions.append(
                f"How does `{metric}` evolve over the observed dates in `{selected_focus['date_column']}`?"
            )

    discovery = {
        "dataset_overview": f"{dataset_name} contains {len(df):,} observations across {len(df.columns)} columns.",
        "status": "ready",
        "selected_focus": selected_focus,
        "options": {
            "metric_columns": clean_numeric,
            "date_columns": datetime_cols,
            "group_columns": categorical_cols,
        },
        "important_metrics": important_metrics,
        "key_findings": key_findings,
        "suggested_questions": questions,
        "goal": focus.get("goal"),
    }
    return insights, discovery


def run_full_analysis(
    df: pd.DataFrame,
    dataset_name: str = "Dataset",
    dataset_id: str = "custom",
    user_target: str | None = None,
    focus: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Execute the complete data science analysis pipeline on a DataFrame."""
    # 1. Input Validation
    if user_target and user_target not in df:
        raise ValueError(f"Target column {user_target!r} does not exist.")
    focus = focus or {}
    for key in ("metric_column", "date_column", "group_column"):
        if focus.get(key) and focus[key] not in df:
            raise ValueError(f"Unknown {key}: {focus[key]}")

    # 2. Schema & Quality Profiling
    schema = get_dataset_schema(df)
    quality = compute_quality_profile(df)
    health = calculate_health_score(df)

    # 3. Descriptive Statistics & Correlations
    stats = compute_descriptive_statistics(
        df,
        numerical_columns=schema["numerical_columns"],
        categorical_columns=schema["categorical_columns"],
    )
    clean_numeric = [
        c
        for c in schema["numerical_columns"]
        if c not in schema["id_columns"] and c not in schema["constant_columns"]
    ]
    correlations = compute_correlations(df, clean_numeric)

    # 4. Target Selection & Machine Learning
    target, problem_type, problem_detection = _detect_problem(df, user_target, schema)
    modeling, plan = _run_modeling_and_plan(df, target, problem_type, clean_numeric)

    # 5. Insight Extraction & Discovery
    insights, discovery = _build_insights_and_discovery(
        df=df,
        dataset_id=dataset_id,
        dataset_name=dataset_name,
        health_score=health,
        quality=quality,
        correlations=correlations,
        modeling=modeling,
        focus=focus,
        clean_numeric=clean_numeric,
        schema=schema,
        target_column=target,
    )

    # 6. Final Payload & Report Generation
    payload: dict[str, Any] = {
        "dataset_id": dataset_id,
        "dataset_name": dataset_name,
        "health_score": health,
        "schema": schema,
        "quality": quality.model_dump(),
        "descriptive_statistics": stats.model_dump(),
        "correlations": correlations.model_dump(),
        "hypothesis_tests": [],
        "problem_detection": problem_detection,
        "plan": plan,
        "modeling": modeling,
        "clustering": None,
        "pca": None,
        "timeseries": None,
        "insights": insights,
        "insight_discovery": discovery,
        "preview_rows": preview_records(df),
    }
    payload["reports"] = {
        "markdown": generate_markdown_report(payload),
        "html": generate_html_report(payload),
    }

    return payload
