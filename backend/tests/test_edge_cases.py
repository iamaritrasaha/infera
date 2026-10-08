"""Comprehensive edge-case, security, and robustness tests for Infera."""

import io

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app.analysis.explanations.provider import TemplateExplanationProvider
from app.analysis.pipeline.detector import detect_problem_type
from app.analysis.pipeline.planner import plan_analyses
from app.analysis.pipeline.runner import run_full_analysis
from app.analysis.pipeline.validator import prepare_supervised_data
from app.analysis.profiler.schema import inspect_schema
from app.analysis.statistics.hypothesis import run_chi_square_test
from app.core.config import Settings
from app.main import app
from app.services.dataset_service import parse_dataset_bytes

client = TestClient(app)


def test_empty_dataframe_rejected():
    """Empty dataframes must raise a descriptive ValueError."""
    with pytest.raises(ValueError, match="empty"):
        parse_dataset_bytes(b"", "empty.csv")

    with pytest.raises(ValueError, match="empty"):
        parse_dataset_bytes(b"a,b,c\n", "header_only.csv")


def test_zero_columns_rejected():
    """A dataframe with no columns must be rejected."""
    empty_df = pd.DataFrame()
    buf = io.BytesIO()
    empty_df.to_csv(buf, index=False)
    with pytest.raises(ValueError):
        parse_dataset_bytes(buf.getvalue(), "nocols.csv")


def test_small_sample_size_handling():
    """Datasets with fewer than 5 rows must fail validation gracefully."""
    df_small = pd.DataFrame(
        {
            "x": [1.0, 2.0, 3.0],
            "y": [10.0, 20.0, 30.0],
        }
    )
    with pytest.raises(ValueError, match="Insufficient valid rows"):
        prepare_supervised_data(df_small, target_col="y", feature_cols=["x"])


def test_all_nan_column_handling():
    """Columns with 100% NaN values must not crash profiling or analysis."""
    df = pd.DataFrame(
        {
            "feature1": [1.0, 2.0, 3.0, 4.0, 5.0, 6.0],
            "all_nan": [None, None, None, None, None, None],
            "target": [10.0, 20.0, 15.0, 25.0, 30.0, 22.0],
        }
    )
    schema = inspect_schema(df)
    assert "all_nan" in [c.name for c in schema.columns]
    nan_meta = next(c for c in schema.columns if c.name == "all_nan")
    assert nan_meta.null_percentage == 100.0

    # Analysis should run smoothly ignoring the NaN column
    res = run_full_analysis(df, dataset_name="NanTest", user_target="target")
    assert res["health_score"] < 100
    assert res["problem_detection"]["problem_type"] == "regression"


def test_all_constant_columns_handling():
    """Columns with zero variance (constants) should be detected and skipped from features."""
    df = pd.DataFrame(
        {
            "constant_num": [42.0] * 20,
            "constant_cat": ["A"] * 20,
            "valid_feature": list(range(20)),
            "target": [i * 2.5 for i in range(20)],
        }
    )
    schema = inspect_schema(df)
    assert "constant_num" in schema.constant_columns
    assert "constant_cat" in schema.constant_columns

    problem = detect_problem_type(df, schema, user_target="target")
    plan = plan_analyses(schema, problem)
    assert "constant_num" not in plan.feature_columns
    assert "constant_cat" not in plan.feature_columns


def test_single_class_classification_target_rejected():
    """A classification target with only 1 class must be rejected with a clear message."""
    df = pd.DataFrame(
        {
            "feat": list(range(10)),
            "single_target": ["yes"] * 10,
        }
    )
    with pytest.raises(ValueError, match="at least 2 distinct classes"):
        prepare_supervised_data(
            df,
            target_col="single_target",
            feature_cols=["feat"],
            is_classification=True,
        )


def test_high_cardinality_columns_do_not_explode_memory():
    """High-cardinality categorical columns must not be one-hot encoded into thousands of columns."""
    df = pd.DataFrame(
        {
            "unique_id": [f"user_{i:04d}" for i in range(100)],
            "numeric_feat": list(range(100)),
            "target": [i % 2 for i in range(100)],
        }
    )
    prepped = prepare_supervised_data(
        df,
        target_col="target",
        feature_cols=["unique_id", "numeric_feat"],
        is_classification=True,
    )
    # The preprocessor must have filtered out unique_id (100 distinct categories > 50)
    assert "numeric_feat" in prepped.feature_names
    assert not any(f.startswith("unique_id") for f in prepped.feature_names)


def test_negative_r2_honest_insight_reporting():
    """When models fail to beat baseline (R2 <= 0), explanations must be honest and conservative."""
    provider = TemplateExplanationProvider()
    insights = provider.explain_model_comparison(
        problem_type="regression",
        target_name="noise_target",
        best_model="Ridge Regression",
        metrics_summary={"r2": -0.15, "rmse": 45.2, "mae": 32.1},
    )
    assert len(insights) > 0
    insight = insights[0]
    assert "not exceeded" in insight.summary.lower()
    assert "non-positive" in insight.plain_english.lower()
    assert "-15.0%" not in insight.plain_english  # Must not claim negative variance explained


def test_cochran_warning_flagged_for_sparse_contingency():
    """Chi-Square test on sparse contingency tables must warn about Cochran assumption violation."""
    df = pd.DataFrame(
        {
            "cat_a": ["A", "B", "A", "B", "A", "B", "A", "B", "A", "B", "A", "B", "A", "B", "C"],
            "cat_b": ["X", "X", "X", "X", "X", "X", "X", "X", "X", "X", "X", "X", "X", "X", "Y"],
        }
    )
    result = run_chi_square_test(df, "cat_a", "cat_b")
    assert result is not None
    assert "Cochran" in result.assumptions_note


def test_corrupted_file_upload_api():
    """Uploading random corrupted binary content returns 400 Bad Request."""
    corrupted_data = b"\x00\xff\xfe\x12\x89\xab\xcd\xef\x00\x01\x02\x03"
    response = client.post(
        "/api/upload",
        files={"file": ("corrupted.csv", corrupted_data, "text/csv")},
    )
    assert response.status_code == 400
    assert "detail" in response.json()


def test_unsupported_file_extension_api():
    """Uploading unsupported extensions returns 400 Bad Request."""
    response = client.post(
        "/api/upload",
        files={"file": ("script.py", b"print('hello')", "text/x-python")},
    )
    assert response.status_code == 400
    assert "Unsupported file format" in response.json()["detail"]


def test_filename_sanitization_in_report_download():
    """Dataset names with special characters or newlines must be sanitized in headers."""
    # Run a quick sample analysis to get a dataset_id
    sample_res = client.post("/api/samples/housing/load")
    assert sample_res.status_code == 200
    ds_id = sample_res.json()["dataset_id"]

    # Trigger analysis
    an_res = client.post("/api/analyze", json={"dataset_id": ds_id})
    assert an_res.status_code == 200

    # Inject dirty dataset name in session store
    from app.services.analysis_service import result_cache

    payload = result_cache.get(ds_id)
    assert payload is not None
    payload["dataset_name"] = "Housing\r\nInjected: Header; test.csv"

    # Download report
    rep_res = client.get(f"/api/results/{ds_id}/report?format=markdown")
    assert rep_res.status_code == 200
    disposition = rep_res.headers.get("content-disposition", "")
    assert "\r" not in disposition
    assert "\n" not in disposition
    assert 'filename="Housing__Injected__Header__test_csv_evidence_report.md"' in disposition


def test_cors_config_parsing_from_env(monkeypatch):
    """CORS_ORIGINS supports comma-separated string env var without JSON syntax."""
    monkeypatch.setenv("CORS_ORIGINS", "https://frontend.vercel.app, http://localhost:3000")
    s = Settings()
    assert "https://frontend.vercel.app" in s.CORS_ORIGINS
    assert "http://localhost:3000" in s.CORS_ORIGINS
