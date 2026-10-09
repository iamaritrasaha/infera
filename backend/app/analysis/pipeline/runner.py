"""Master orchestration runner coordinating data profiling, statistical testing, and machine learning."""

from dataclasses import asdict, dataclass

import pandas as pd

from app.analysis.classification.runner import (
    train_and_evaluate_classification,
)
from app.analysis.clustering.runner import run_clustering_suite
from app.analysis.dimensionality.pca import compute_pca
from app.analysis.explanations.provider import StructuredInsight, TemplateExplanationProvider
from app.analysis.insights.discovery import Question, discover_insights
from app.analysis.pipeline.detector import detect_problem_type
from app.analysis.pipeline.planner import SkippedAnalysis, plan_analyses
from app.analysis.pipeline.validator import prepare_supervised_data
from app.analysis.profiler.cardinality import CardinalityProfile, analyze_cardinality
from app.analysis.profiler.duplicates import DuplicateProfile, analyze_duplicates
from app.analysis.profiler.missing import MissingProfile, analyze_missing_values
from app.analysis.profiler.outliers import OutlierProfile, analyze_outliers
from app.analysis.profiler.schema import inspect_schema
from app.analysis.regression.runner import train_and_evaluate_regression
from app.analysis.reporting.report import generate_html_report, generate_markdown_report
from app.analysis.statistics.correlation import compute_correlations
from app.analysis.statistics.descriptive import compute_descriptive_statistics
from app.analysis.statistics.hypothesis import run_automated_hypothesis_suite
from app.analysis.timeseries.decomposition import analyze_timeseries


@dataclass
class QualityProfile:
    """Consolidated dataset quality metrics."""

    missing: MissingProfile
    duplicates: DuplicateProfile
    outliers: OutlierProfile
    cardinality: CardinalityProfile
    health_score: int  # 0 to 100


def compute_health_score(
    missing: MissingProfile,
    duplicates: DuplicateProfile,
    outliers: OutlierProfile,
) -> int:
    """Computes a deterministic 0-100 data hygiene score."""
    score = 100.0
    # Penalty for missing data
    score -= missing.overall_missing_percentage * 1.5
    # Penalty for duplicate rows
    score -= duplicates.duplicate_rows_percentage * 2.0
    # Penalty for outliers
    score -= min(15.0, outliers.total_iqr_outliers * 0.15)
    return max(0, min(100, int(round(score))))


def run_full_analysis(
    df: pd.DataFrame,
    dataset_name: str = "Dataset",
    user_target: str | None = None,
    metric_column: str | None = None,
    date_column: str | None = None,
    group_column: str | None = None,
    question: Question = "automatic",
) -> dict:
    """Orchestrates comprehensive profiling, statistics, ML benchmarking, and insight generation."""
    # 1. Schema & Profiling
    schema = inspect_schema(df)
    missing = analyze_missing_values(df)
    duplicates = analyze_duplicates(df, id_columns=schema.id_columns)
    outliers = analyze_outliers(df, schema.numerical_columns)
    cardinality = analyze_cardinality(df, schema.categorical_columns)

    health_score = compute_health_score(missing, duplicates, outliers)
    QualityProfile(
        missing=missing,
        duplicates=duplicates,
        outliers=outliers,
        cardinality=cardinality,
        health_score=health_score,
    )

    # 2. Descriptive Statistics & Correlations
    stats = compute_descriptive_statistics(df, schema.numerical_columns, schema.categorical_columns)
    analysis_numerical = [c for c in schema.numerical_columns if c not in schema.id_columns and c not in schema.constant_columns]
    correlations = compute_correlations(df, analysis_numerical)

    # 3. Problem Detection & Planning
    problem = detect_problem_type(df, schema, user_target=user_target)
    plan = plan_analyses(schema, problem)

    # 4. Hypothesis Testing
    hypothesis_tests = run_automated_hypothesis_suite(
        df=df,
        numerical_cols=analysis_numerical,
        categorical_cols=schema.categorical_columns,
        target_col=problem.target_column,
    )

    # 5. Machine Learning Execution
    modeling_result = None
    if plan.can_run_ml and problem.target_column:
        try:
            if problem.problem_type == "regression":
                prepped = prepare_supervised_data(
                    df=df,
                    target_col=problem.target_column,
                    feature_cols=plan.feature_columns,
                    is_classification=False,
                )
                reg_res = train_and_evaluate_regression(prepped)
                modeling_result = asdict(reg_res)
            elif problem.problem_type in ["binary_classification", "multiclass_classification"]:
                prepped = prepare_supervised_data(
                    df=df,
                    target_col=problem.target_column,
                    feature_cols=plan.feature_columns,
                    is_classification=True,
                )
                cls_res = train_and_evaluate_classification(prepped)
                modeling_result = asdict(cls_res)
        except Exception as e:
            plan.skipped_analyses.append(
                SkippedAnalysis(name="ML Execution", category="ml", reason=str(e) if isinstance(e, ValueError) else "Model fitting failed; no metrics are reported.")
            )

    # 6. Unsupervised Clustering
    clustering_res = None
    if any(p.category == "clustering" for p in plan.planned_analyses):
        try:
            num_feats = [
                c
                for c in schema.numerical_columns
                if c != problem.target_column and c not in schema.id_columns and c not in schema.constant_columns
            ]
            cl_out = run_clustering_suite(df, num_feats)
            if cl_out:
                clustering_res = asdict(cl_out)
            else:
                plan.skipped_analyses.append(SkippedAnalysis("Clustering", "clustering", "Requires at least 15 complete rows, two varying numerical features, and valid cluster separation."))
        except Exception:
            plan.skipped_analyses.append(SkippedAnalysis("Clustering", "clustering", "Clustering could not be computed for these observations."))

    # 7. PCA Decomposition
    pca_res = None
    if any(p.category == "dimensionality" for p in plan.planned_analyses):
        try:
            num_feats = [
                c
                for c in schema.numerical_columns
                if c != problem.target_column and c not in schema.id_columns and c not in schema.constant_columns
            ]
            p_out = compute_pca(df, num_feats)
            if p_out:
                pca_res = asdict(p_out)
            else:
                plan.skipped_analyses.append(SkippedAnalysis("PCA", "dimensionality", "Requires at least 10 complete rows and two varying numerical features."))
        except Exception:
            plan.skipped_analyses.append(SkippedAnalysis("PCA", "dimensionality", "PCA could not be computed for these observations."))

    # 8. Time Series Diagnostic
    ts_res = None
    if problem.problem_type == "time_series" and schema.datetime_columns and problem.target_column:
        try:
            ts_out = analyze_timeseries(df, schema.datetime_columns[0], problem.target_column)
            if ts_out:
                ts_res = asdict(ts_out)
            else:
                plan.skipped_analyses.append(SkippedAnalysis("Time Series", "timeseries", "Requires at least 15 observations with valid timestamps and numerical values."))
        except Exception:
            plan.skipped_analyses.append(SkippedAnalysis("Time Series", "timeseries", "Time-series diagnostics could not be computed."))

    # 9. Evidence-Backed Explanations & Insights
    provider = TemplateExplanationProvider()
    insights: list[StructuredInsight] = []

    # Quality insights
    insights.extend(
        provider.explain_data_quality(
            missing_pct=missing.overall_missing_percentage,
            duplicate_count=duplicates.duplicate_rows_count,
            duplicate_pct=duplicates.duplicate_rows_percentage,
            outlier_count=outliers.total_iqr_outliers,
            health_score=health_score,
        )
    )

    # Correlation insights
    if correlations.top_correlations:
        insights.extend(
            provider.explain_relationships([asdict(c) for c in correlations.top_correlations])
        )

    # Hypothesis insights
    if hypothesis_tests:
        insights.extend(provider.explain_hypothesis_tests([asdict(t) for t in hypothesis_tests]))

    # Modeling insights
    if modeling_result and modeling_result.get("summary_table"):
        best_row = next(
            (r for r in modeling_result["summary_table"] if r.get("is_best")),
            modeling_result["summary_table"][0],
        )
        insights.extend(
            provider.explain_model_comparison(
                problem_type=problem.problem_type,
                target_name=str(problem.target_column),
                best_model=modeling_result.get("best_model_name", "Champion Model"),
                metrics_summary=best_row,
            )
        )

    # Assemble complete payload
    insight_discovery = discover_insights(
        df,
        dataset_name,
        numerical_columns=schema.numerical_columns,
        categorical_columns=schema.categorical_columns,
        datetime_columns=schema.datetime_columns,
        id_columns=schema.id_columns,
        constant_columns=schema.constant_columns,
        target_column=problem.target_column,
        metric_column=metric_column,
        date_column=date_column,
        group_column=group_column,
        question=question,
        modeling=modeling_result,
    )
    payload = {
        "dataset_name": dataset_name,
        "health_score": health_score,
        "schema": asdict(schema),
        "quality": {
            "missing": asdict(missing),
            "duplicates": asdict(duplicates),
            "outliers": asdict(outliers),
            "cardinality": asdict(cardinality),
        },
        "descriptive_statistics": asdict(stats),
        "correlations": asdict(correlations),
        "hypothesis_tests": [asdict(t) for t in hypothesis_tests],
        "problem_detection": asdict(problem),
        "plan": asdict(plan),
        "modeling": modeling_result,
        "clustering": clustering_res,
        "pca": pca_res,
        "timeseries": ts_res,
        "insights": [asdict(i) for i in insights],
        "insight_discovery": insight_discovery,
        "preview_rows": df.head(10).to_dict(orient="records"),
    }

    from app.core.serialization import sanitize_for_json

    payload = sanitize_for_json(payload)
    # Generate Reports
    payload["reports"] = {
        "markdown": generate_markdown_report(payload),
        "html": generate_html_report(payload),
    }

    return payload
