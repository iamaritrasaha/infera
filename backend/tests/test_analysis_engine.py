"""Unit tests for Infera analysis engine verifying independent execution from web server."""

from pathlib import Path

import pandas as pd

from app.analysis.pipeline.runner import run_full_analysis
from app.analysis.profiler.duplicates import analyze_duplicates
from app.analysis.profiler.missing import analyze_missing_values
from app.analysis.profiler.outliers import analyze_outliers
from app.analysis.profiler.schema import inspect_schema
from app.analysis.statistics.correlation import compute_correlations
from app.analysis.statistics.hypothesis import run_automated_hypothesis_suite

SAMPLE_DIR = Path(__file__).resolve().parent.parent.parent / "sample_data"


def test_schema_profiling_housing():
    """Verify schema detection on housing dataset."""
    df = pd.read_csv(SAMPLE_DIR / "housing.csv")
    schema = inspect_schema(df)
    assert schema.row_count > 100
    assert "price" in schema.numerical_columns
    assert "id" in schema.id_columns
    assert len(schema.potential_targets) > 0


def test_data_quality_metrics():
    """Verify missing, duplicate, and outlier calculations."""
    df = pd.read_csv(SAMPLE_DIR / "housing.csv")
    missing = analyze_missing_values(df)
    assert missing.total_cells > 0
    assert missing.complete_rows_count > 0

    duplicates = analyze_duplicates(df, ["id"])
    assert duplicates.total_rows == len(df)
    assert duplicates.duplicate_rows_count >= 0

    schema = inspect_schema(df)
    outliers = analyze_outliers(df, schema.numerical_columns)
    assert outliers.total_numerical_columns_analyzed > 0


def test_correlations_and_significance():
    """Verify Pearson and Spearman correlation computation."""
    df = pd.read_csv(SAMPLE_DIR / "housing.csv")
    schema = inspect_schema(df)
    corrs = compute_correlations(df, schema.numerical_columns)
    assert len(corrs.columns) >= 2
    assert len(corrs.pearson_matrix) == len(corrs.columns)
    if corrs.top_correlations:
        top = corrs.top_correlations[0]
        assert -1.0 <= top.pearson_r <= 1.0
        assert 0.0 <= top.pearson_p_value <= 1.0


def test_hypothesis_tests():
    """Verify hypothesis suite runs correctly."""
    df = pd.read_csv(SAMPLE_DIR / "customer_churn.csv")
    schema = inspect_schema(df)
    tests = run_automated_hypothesis_suite(
        df=df,
        numerical_cols=schema.numerical_columns,
        categorical_cols=schema.categorical_columns,
        target_col="churned",
    )
    assert len(tests) > 0
    for t in tests:
        assert t.p_value >= 0.0
        assert t.statistic_name != ""
        assert t.interpretation != ""


def test_full_pipeline_housing_regression():
    """Verify full end-to-end regression pipeline on housing data."""
    df = pd.read_csv(SAMPLE_DIR / "housing.csv")
    result = run_full_analysis(df, dataset_name="Housing Sample", user_target="price")

    assert result["dataset_name"] == "Housing Sample"
    assert result["health_score"] > 50
    assert result["problem_detection"]["problem_type"] == "regression"
    assert result["modeling"] is not None
    assert len(result["modeling"]["models"]) >= 4
    assert result["modeling"]["best_model_name"] != ""
    assert len(result["insights"]) >= 3
    assert "markdown" in result["reports"]
    assert "html" in result["reports"]


def test_full_pipeline_churn_classification():
    """Verify full end-to-end classification pipeline on churn data."""
    df = pd.read_csv(SAMPLE_DIR / "customer_churn.csv")
    result = run_full_analysis(df, dataset_name="Churn Sample", user_target="churned")

    assert result["problem_detection"]["problem_type"] == "binary_classification"
    assert result["modeling"] is not None
    assert len(result["modeling"]["models"]) >= 4
    # Check confusion matrix present
    best_m = result["modeling"]["models"][0]
    assert len(best_m["confusion_matrix"]) == 2
    assert len(result["insights"]) >= 3
