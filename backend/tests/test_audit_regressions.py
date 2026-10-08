"""Regression coverage for ownership, resource limits, and computed evidence."""

import asyncio
import io
import json
from dataclasses import asdict
from pathlib import Path

import numpy as np
import pandas as pd
import pytest
from fastapi.testclient import TestClient
from scipy import stats
from sklearn.impute import SimpleImputer
from sklearn.metrics import accuracy_score, f1_score

from app.analysis.classification.runner import train_and_evaluate_classification
from app.analysis.clustering.runner import run_clustering_suite
from app.analysis.dimensionality.pca import compute_pca
from app.analysis.pipeline.validator import prepare_supervised_data
from app.analysis.profiler.distributions import analyze_numerical_distribution
from app.analysis.profiler.schema import inspect_schema
from app.analysis.regression.runner import train_and_evaluate_regression
from app.analysis.statistics.correlation import compute_correlations
from app.analysis.timeseries.decomposition import analyze_timeseries
from app.core.config import settings
from app.core.limits import UploadLimitMiddleware
from app.core.serialization import sanitize_for_json
from app.main import app
from app.services.dataset_service import DatasetSessionStore, parse_dataset_bytes

HEADERS = {"X-Infera-Session": "d" * 64}
client = TestClient(app, headers=HEADERS)


@pytest.fixture(scope="module")
def analyzed():
    loaded = client.post("/api/samples/housing/load")
    assert loaded.status_code == 200
    dataset_id = loaded.json()["dataset_id"]
    result = client.post("/api/analyze", json={"dataset_id": dataset_id, "target_column": "price"})
    assert result.status_code == 200
    return dataset_id, result.json()


@pytest.mark.parametrize("endpoint", ["/api/upload", "/api/samples/housing/load", "/api/analyze"])
def test_private_mutations_require_session(endpoint):
    response = TestClient(app).post(endpoint, json={"dataset_id": "a" * 36})
    assert response.status_code == 401
    response = TestClient(app, headers={"X-Infera-Session": "invalid"}).post(endpoint)
    assert response.status_code == 403


def test_cross_session_analysis_results_reports_are_private(analyzed):
    dataset_id, _ = analyzed
    foreign = TestClient(app, headers={"X-Infera-Session": "e" * 64})
    assert foreign.post("/api/analyze", json={"dataset_id": dataset_id}).status_code == 404
    for suffix in ["", "/report?format=markdown", "/report?format=html"]:
        assert foreign.get(f"/api/results/{dataset_id}{suffix}").status_code == 404
        assert TestClient(app).get(f"/api/results/{dataset_id}{suffix}").status_code == 401
    response = client.get(f"/api/results/{dataset_id}")
    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    assert "X-Infera-Session" in response.headers["vary"]


def test_safe_retry_reuses_completed_analysis(analyzed, monkeypatch):
    from app.services import analysis_service

    def unexpected(*args, **kwargs):
        pytest.fail("An identical retry retrained models")

    monkeypatch.setattr(analysis_service, "run_full_analysis", unexpected)
    dataset_id, previous = analyzed
    response = client.post("/api/analyze", json={"dataset_id": dataset_id, "target_column": "price"})
    assert response.status_code == 200
    assert response.json()["modeling"] == previous["modeling"]


@pytest.mark.parametrize("extension", ["csv", "xlsx", "json", "parquet"])
def test_actual_supported_upload_formats(extension):
    df = pd.DataFrame({"measurement": [1.5, 2.5, 3.5], "group": ["a", "b", "a"]})
    buf = io.BytesIO()
    if extension == "csv":
        content = df.to_csv(index=False).encode()
    elif extension == "json":
        content = df.to_json(orient="records").encode()
    elif extension == "xlsx":
        df.to_excel(buf, index=False)
        content = buf.getvalue()
    else:
        df.to_parquet(buf, index=False)
        content = buf.getvalue()
    response = client.post("/api/upload", files={"file": (f"data.{extension}", content)})
    assert response.status_code == 201, response.text
    assert response.json()["row_count"] == 3
    assert response.json()["columns"][0]["inferred_type"] == "numerical"


@pytest.mark.parametrize("content,name", [
    (b"a,a\n1,2\n", "duplicate.csv"),
    (b"a, a \n1,2\n", "trimmed.csv"),
    (b"a,b\n", "empty.csv"),
    (b'[{"nested": [1, 2]}]', "nested.json"),
    (b"x\ninf\n1\n", "infinite.csv"),
])
def test_ambiguous_or_invalid_input_rejected(content, name):
    response = client.post("/api/upload", files={"file": (name, content)})
    assert response.status_code == 400
    assert "Traceback" not in response.text


def test_upload_dimension_and_decoded_memory_limits(monkeypatch):
    monkeypatch.setattr(settings, "MAX_ROW_COUNT", 2)
    with pytest.raises(ValueError, match="rows"):
        parse_dataset_bytes(b"x\n1\n2\n3\n", "rows.csv")
    monkeypatch.setattr(settings, "MAX_COLUMN_COUNT", 1)
    with pytest.raises(ValueError, match="columns"):
        parse_dataset_bytes(b"a,b\n1,2\n", "cols.csv")
    monkeypatch.setattr(settings, "MAX_DATASET_MEMORY_BYTES", 1)
    with pytest.raises(ValueError, match="memory"):
        parse_dataset_bytes(b"x\n1\n", "memory.csv")


def test_oversized_declared_upload_rejected_before_receive():
    response = client.post("/api/upload", headers={"Content-Length": str(settings.MAX_UPLOAD_SIZE_BYTES + 65537)})
    assert response.status_code == 413


def test_chunked_upload_limit_stops_consuming_stream(monkeypatch):
    monkeypatch.setattr(settings, "MAX_UPLOAD_SIZE_BYTES", 1)
    received = 0
    sent = []

    async def downstream(scope, receive, send):
        while (await receive())["more_body"]:
            pass

    async def receive():
        nonlocal received
        received += 1
        return {"type": "http.request", "body": b"x" * 32768, "more_body": True}

    async def send(message):
        sent.append(message)

    middleware = UploadLimitMiddleware(downstream)
    asyncio.run(middleware({"type": "http", "path": "/api/upload", "headers": []}, receive, send))
    assert received == 3  # Stops on the first chunk exceeding file plus multipart envelope.
    assert sent[0]["status"] == 413
    assert not middleware.upload_gate.locked()


def test_streaming_limit_survives_multipart_parser(monkeypatch):
    monkeypatch.setattr(settings, "MAX_UPLOAD_SIZE_BYTES", 16)
    response = client.post("/api/upload", files={"file": ("large.csv", b"x" * 70000)})
    assert response.status_code == 413
    small = client.post("/api/upload", files={"file": ("small.csv", b"x\n1\n")})
    assert small.status_code == 201


def test_expiry_eviction_and_owner_check(monkeypatch):
    clock = [0.0]
    monkeypatch.setattr("app.services.dataset_service.time.monotonic", lambda: clock[0])
    store = DatasetSessionStore(max_items=1, ttl_seconds=10)
    df = pd.DataFrame({"x": [1]})
    first = store.put(df, "one", "owner")
    assert store.get(first, "foreign") is None
    second = store.put(df, "two", "owner")
    assert store.get(first, "owner") is None
    assert store.get(second, "owner") is not None
    clock[0] = 11
    assert store.get(second, "owner") is None


def test_cors_allows_session_header_only_on_configured_origins():
    request_headers = {"Origin": "https://infera-omega.vercel.app", "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "x-infera-session,content-type"}
    response = client.options("/api/upload", headers=request_headers)
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == request_headers["Origin"]
    request_headers["Origin"] = "https://attacker.example"
    response = client.options("/api/upload", headers=request_headers)
    assert response.status_code == 400
    assert "access-control-allow-origin" not in response.headers


def test_invalid_targets_and_unknown_samples_have_readable_errors(analyzed):
    dataset_id, _ = analyzed
    response = client.post("/api/analyze", json={"dataset_id": dataset_id, "target_column": "does_not_exist"})
    assert response.status_code == 400
    assert "target" in response.text.lower()
    assert client.post("/api/samples/missing/load").status_code == 404
    assert client.get(f"/api/results/{dataset_id}/report?format=pickle").status_code == 422


def test_report_safety_and_complete_metrics(analyzed):
    dataset_id, result = analyzed
    html = client.get(f"/api/results/{dataset_id}/report?format=html")
    assert html.headers["cache-control"] == "no-store"
    assert "sandbox" in html.headers["content-security-policy"]
    assert "Aritra Saha" in html.text
    assert "MAE" in html.text and "RMSE" in html.text and "R²" in html.text
    assert "<svg" in html.text
    assert "Descriptive Statistics" in html.text
    assert "Assumptions and limitations" in html.text
    from app.analysis.reporting.report import generate_html_report

    malicious = dict(result, dataset_name='<img src=x onerror="alert(1)">')
    report = generate_html_report(malicious)
    assert '<img src=x onerror="alert(1)">' not in report
    assert "&lt;img" in report


def test_schema_keeps_continuous_unique_measurements():
    df = pd.DataFrame({"measurement": np.linspace(0.1, 1.1, 50), "record_id": np.arange(50)})
    schema = inspect_schema(df)
    assert "measurement" not in schema.id_columns
    assert "record_id" in schema.id_columns


def test_correlation_matches_scipy_and_unavailable_pairs_are_null():
    df = pd.DataFrame({"x": list(range(10)) + [None] * 10, "y": [x * x for x in range(10)] + [None] * 10, "disjoint": [None] * 10 + list(range(10)), "constant": [3] * 20})
    result = compute_correlations(df, list(df))
    pair = next(p for p in result.top_correlations if {p.feature_a, p.feature_b} == {"x", "y"})
    expected = stats.pearsonr(df.x.dropna(), df.y.dropna())
    assert pair.pearson_r == pytest.approx(expected.statistic, abs=0.0001)
    assert pair.pearson_p_value == pytest.approx(expected.pvalue)
    assert "constant" not in result.columns
    a, b = result.columns.index("x"), result.columns.index("disjoint")
    assert result.pearson_matrix[a][b] is None


def test_constant_and_singleton_distribution_do_not_invent_moments():
    constant = sanitize_for_json(asdict(analyze_numerical_distribution(pd.Series([5] * 20))))
    assert constant["skewness"] is None and constant["kurtosis"] is None
    single = sanitize_for_json(asdict(analyze_numerical_distribution(pd.Series([5]))))
    assert single["std"] is None and single["variance"] is None
    assert sum(b["count"] for b in constant["histogram"]) == 20


def test_train_only_imputation_and_fold_isolation(monkeypatch):
    df = pd.DataFrame({"feature": [np.nan if i % 7 == 0 else float(i) for i in range(60)], "target": [i * 1.7 for i in range(60)]})
    prepared = prepare_supervised_data(df, "target", ["feature"])
    assert prepared.preprocessor.named_transformers_["num"].named_steps["imputer"].statistics_[0] == prepared.x_train_raw.feature.median()
    fitted_sizes = []
    original_fit = SimpleImputer.fit

    def track_fit(self, values, *args, **kwargs):
        fitted_sizes.append(len(values))
        return original_fit(self, values, *args, **kwargs)

    monkeypatch.setattr(SimpleImputer, "fit", track_fit)
    result = train_and_evaluate_regression(prepared)
    assert result.models
    assert fitted_sizes and all(size < prepared.train_size for size in fitted_sizes)
    assert len(fitted_sizes) >= result.cv_folds * len(result.models)


def test_cv_failure_is_unavailable_instead_of_holdout_score(monkeypatch):
    from app.analysis.regression import runner

    def fail(*args, **kwargs):
        raise ValueError("Simulated CV failure")

    monkeypatch.setattr(runner, "cross_val_score", fail)
    df = pd.DataFrame({"x": range(30), "target": np.arange(30) * 2.5})
    result = train_and_evaluate_regression(prepare_supervised_data(df, "target", ["x"]))
    assert all(m.cv_r2_mean is None and m.cv_r2_std is None for m in result.models)
    assert "optimistic" in result.selection_method
    linear = next(m for m in result.models if m.model_name == "linear")
    assert linear.r2_test == pytest.approx(1)
    assert linear.mae_test == pytest.approx(0, abs=0.001)
    assert linear.rmse_test == pytest.approx(0, abs=0.001)


def test_missing_targets_and_duplicate_observations_removed_before_split():
    df = pd.DataFrame({"x": range(30), "target": np.arange(30) * 2.5})
    df = pd.concat([df, df.iloc[:10], pd.DataFrame({"x": [100], "target": [None]})], ignore_index=True)
    df["record_id"] = range(len(df))
    result = prepare_supervised_data(df, "target", ["x"])
    assert result.preparation["missing_target_rows"] == 1
    assert result.preparation["duplicate_rows_removed"] == 10
    assert result.train_size + result.test_size == 30


def test_classification_metrics_baseline_and_rare_classes():
    df = pd.DataFrame({"x": range(80), "target": ["rare" if i % 8 == 0 else "common" for i in range(80)]})
    prepared = prepare_supervised_data(df, "target", ["x"], is_classification=True)
    result = train_and_evaluate_classification(prepared)
    baseline = next(m for m in result.models if m.model_name == "dummy")
    expected = np.full_like(prepared.y_test, np.argmax(np.bincount(prepared.y_train)))
    assert baseline.accuracy_test == pytest.approx(accuracy_score(prepared.y_test, expected), abs=0.0001)
    assert baseline.f1_macro == pytest.approx(f1_score(prepared.y_test, expected, average="macro"), abs=0.0001)
    assert prepared.has_class_imbalance
    assert all(sum(map(sum, m.confusion_matrix)) == prepared.test_size for m in result.models)
    assert sum(m.is_best_model for m in result.models) == 1
    df.loc[df.target == "rare", "target"] = "common"
    df.loc[0, "target"] = "rare"
    with pytest.raises(ValueError, match="2 observations"):
        prepare_supervised_data(df, "target", ["x"], is_classification=True)


def test_unsupervised_limits_and_degenerate_inputs(monkeypatch):
    monkeypatch.setattr(settings, "MAX_CLUSTER_ROWS", 100)
    df = pd.DataFrame(np.random.default_rng(42).normal(size=(250, 3)), columns=["x", "y", "z"])
    result = run_clustering_suite(df, list(df))
    assert result.sample_count == 100
    assert result.original_rows == 250
    assert len(result.kmeans_result.scatter_2d) <= 120
    pca = compute_pca(df, list(df))
    assert len(pca.points_2d) <= 100
    assert 0 <= pca.cumulative_variance_explained <= 1
    assert run_clustering_suite(pd.DataFrame({"x": [1] * 20, "y": [1] * 20}), ["x", "y"]) is None


def test_adf_failure_never_invents_statistics(monkeypatch):
    from app.analysis.timeseries import decomposition

    def fail(*args, **kwargs):
        raise ValueError("ADF failure")

    monkeypatch.setattr(decomposition, "adfuller", fail)
    df = pd.DataFrame({"date": pd.date_range("2024-01-01", periods=30), "value": np.arange(30) - 15})
    result = analyze_timeseries(df, "date", "value")
    assert result.adf_statistic is None and result.adf_p_value is None
    assert result.is_stationary is None
    assert len(result.chart_series) == 30
    assert result.chart_series[0]["value"] == -15


def test_shared_icon_assets_and_project_text():
    root = Path(__file__).resolve().parents[2]
    icon = (root / "frontend/public/infera-icon.svg").read_bytes()
    for path in ["assets/infera-icon.svg", "frontend/app/icon.svg", "backend/app/analysis/reporting/infera-icon.svg"]:
        assert (root / path).read_bytes() == icon
    # Scan maintained source and documentation, preserving dependency and generated files.
    for directory in [root / "backend/app", root / "frontend/app", root / "frontend/components", root / "frontend/lib"]:
        for path in directory.rglob("*"):
            if path.suffix in {".py", ".tsx", ".ts", ".css", ".svg"}:
                assert chr(8212) not in path.read_text(), str(path)
    json.dumps(sanitize_for_json({"value": np.nan}), allow_nan=False)


@pytest.mark.parametrize("sample,target,problem", [
    ("housing", "price", "regression"),
    ("customer_churn", "churned", "binary_classification"),
    ("student_performance", "performance_tier", "multiclass_classification"),
    ("retail_sales", "weekly_sales", "time_series"),
])
def test_every_sample_runs_the_complete_pipeline(sample, target, problem):
    loaded = client.post(f"/api/samples/{sample}/load")
    assert loaded.status_code == 200
    assert loaded.json()["recommended_target"] == target
    result = client.post("/api/analyze", json={"dataset_id": loaded.json()["dataset_id"], "target_column": target})
    assert result.status_code == 200, result.text
    payload = result.json()
    assert payload["problem_detection"]["problem_type"] == problem
    assert payload["timeseries"] is not None if problem == "time_series" else payload["modeling"] is not None
    assert all(p["feature_a"] != p["feature_b"] for p in payload["hypothesis_tests"])
    assert not (set(payload["correlations"]["columns"]) & set(payload["schema"]["id_columns"]))


def test_negative_silhouette_remains_a_real_score(monkeypatch):
    monkeypatch.setattr("app.analysis.clustering.runner.silhouette_score", lambda *args, **kwargs: -0.2)
    df = pd.DataFrame(np.random.default_rng(11).normal(size=(50, 2)), columns=["x", "y"])
    result = run_clustering_suite(df, list(df))
    assert result.kmeans_result.silhouette == -0.2


def test_correlations_are_scale_invariant_and_preserve_tiny_p_values():
    df = pd.DataFrame({"tiny": np.arange(1, 51) * 1e-12, "large": np.arange(1, 51) * 1e12})
    result = compute_correlations(df, list(df))
    pair = result.top_correlations[0]
    assert pair.pearson_r == 1
    assert pair.evidence_summary["pearson_p_value"] == pair.pearson_p_value
