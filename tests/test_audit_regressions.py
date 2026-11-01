"""Reproduce defects missed by the original refactor's happy-path tests."""

import io

import numpy as np
import pandas as pd
import pytest
from fastapi.testclient import TestClient
from sklearn.impute import SimpleImputer
from sklearn.model_selection import train_test_split

from infera import main
from infera.data_loader import load_csv, load_dataset
from infera.regression import prepare_regression_data, train_regression_models


@pytest.fixture
def client():
    main.DATASETS.clear()
    main.RESULTS.clear()
    main.OWNERS.clear()
    with TestClient(main.app) as client:
        yield client
    main.DATASETS.clear()
    main.RESULTS.clear()
    main.OWNERS.clear()


@pytest.mark.parametrize(
    "content",
    [
        b"x, x\n1,2\n2,3\n3,4",
        b",y\n1,2\n2,3\n3,4",
        b"x,y\n1,2,3\n2,3\n3,4",
        b"x,y\n1,inf\n2,3\n3,4",
        b"x\n1\n2\n1e100",
        b"x\n1\n2\n\x00",
        b"x\n\xff\n2\n3",
    ],
)
def test_invalid_csv_is_rejected(content):
    with pytest.raises(ValueError):
        load_csv(content)


def test_limits(monkeypatch):
    from infera import data_loader

    monkeypatch.setattr(data_loader, "MAX_ROWS", 3)
    with pytest.raises(ValueError, match="3 rows"):
        load_csv(b"x\n1\n2\n3\n4")
    monkeypatch.setattr(data_loader, "MAX_COLUMNS", 1)
    with pytest.raises(ValueError, match="1 columns"):
        load_csv(b"x,y\n1,2\n2,3\n3,4")


@pytest.mark.parametrize("suffix", ["csv", "xlsx", "json", "parquet"])
def test_advertised_formats(suffix):
    df = pd.DataFrame({"x": [1, 2, 3], "target": [3, 5, 7]})
    buffer = io.BytesIO()
    if suffix == "csv":
        content = df.to_csv(index=False).encode()
    elif suffix == "json":
        content = df.to_json(orient="records").encode()
    else:
        if suffix == "xlsx":
            df.to_excel(buffer, index=False)
        else:
            df.to_parquet(buffer, index=False)
        content = buffer.getvalue()
    pd.testing.assert_frame_equal(load_dataset(content, f"data.{suffix}"), df)


def test_missing_data_end_to_end_and_reports(client):
    csv = "x,target,empty\n" + "\n".join(f"{i if i != 4 else ''},{2 * i + 1}," for i in range(30))
    uploaded = client.post("/api/upload", files={"file": ("<script>alert(1)</script>.csv", csv)})
    assert uploaded.status_code == 201, uploaded.text
    data = uploaded.json()
    assert data["preview_rows"][4]["x"] is None
    response = client.post(
        "/api/analyze", json={"dataset_id": data["dataset_id"], "target_column": "target"}
    )
    assert response.status_code == 200, response.text
    result = response.json()
    assert result["modeling"] is not None
    empty = next(s for s in result["descriptive_statistics"]["numerical"] if s["column"] == "empty")
    assert empty["min"] is None and empty["mean"] is None
    assert result["quality"]["missing"]["total_missing_cells"] == 31
    path = f"/api/results/{data['dataset_id']}"
    assert client.get(path).json() == result
    assert "text/markdown" in client.get(path + "/report").headers["content-type"]
    html = client.get(path + "/report?format=html").text
    assert "<script>" not in html
    assert (
        client.post(
            "/api/analyze", json={"dataset_id": data["dataset_id"], "target_column": "missing"}
        ).status_code
        == 400
    )


def test_all_samples_are_loadable_with_truthful_metadata(client):
    for sample in client.get("/api/samples").json():
        uploaded = client.post(f"/api/samples/{sample['id']}/load")
        assert uploaded.status_code == 200, uploaded.text
        data = uploaded.json()
        assert data["row_count"] == sample["row_count"]
        assert data["column_count"] == sample["column_count"]
        result = client.post(
            "/api/analyze",
            json={"dataset_id": data["dataset_id"], "target_column": sample["recommended_target"]},
        )
        assert result.status_code == 200, result.text
        if sample["id"] == "customer_churn":
            assert result.json()["modeling"] is None
            assert any(
                s["name"] == "Classification" for s in result.json()["plan"]["skipped_analyses"]
            )
        else:
            assert result.json()["modeling"] is not None


def test_preprocessing_fits_only_training_folds(monkeypatch):
    df = pd.DataFrame(
        {"x": [np.nan if i % 6 == 0 else float(i) for i in range(30)], "y": np.arange(30.0) * 2}
    )
    X, y, _ = prepare_regression_data(df, "y")
    assert X.isna().any().any(), "Preparation must not impute before splitting"
    train, _, _, _ = train_test_split(X, y, test_size=0.2, random_state=42)
    seen = []
    original = SimpleImputer.fit

    def record_fit(self, X, y=None, **kwargs):
        seen.append(set(X.index))
        return original(self, X, y, **kwargs)

    monkeypatch.setattr(SimpleImputer, "fit", record_fit)
    result = train_regression_models(df, "y")
    assert all(indexes <= set(train.index) for indexes in seen)
    winner = next(m for m in result.models if m.is_best_model)
    assert winner.cv_r2_mean == max(m.cv_r2_mean for m in result.models)
    for model in result.models:
        assert model.rmse_test == pytest.approx(np.sqrt(model.mse_test), abs=0.001)


@pytest.mark.parametrize("features", [["x", "y"], ["unknown"], ["category"], ["x", "x"]])
def test_invalid_predictors(features):
    df = pd.DataFrame({"x": range(20), "y": range(20), "category": ["a", "b"] * 10})
    with pytest.raises(ValueError):
        prepare_regression_data(df, "y", features)


def test_small_training_set_has_honest_cv_metadata():
    result = train_regression_models(pd.DataFrame({"x": range(10), "y": range(10)}), "y")
    assert result.cv_folds == 0
    assert result.best_model_name == "Linear Regression"
    assert all(m.cv_r2_mean is None for m in result.models)


def test_regression_deduplicates_before_splitting():
    df = pd.DataFrame({"x": range(20), "y": range(20)})
    result = train_regression_models(pd.concat([df, df]), "y")
    assert result.train_samples + result.test_samples == 20


def test_constant_holdout_is_not_reported_as_a_valid_r_squared():
    df = pd.DataFrame({"x": range(20), "y": np.arange(20.0)})
    _, test_indices = train_test_split(df.index, test_size=0.2, random_state=42)
    df.loc[test_indices, "y"] = 1.0
    with pytest.raises(ValueError, match="holdout targets must both vary"):
        train_regression_models(df, "y")


def test_boolean_columns_and_owner_isolation(client):
    uploaded = client.post(
        "/api/upload",
        files={"file": ("bool.csv", "flag,x\nTrue,1\nFalse,2\nTrue,3")},
        headers={"X-Infera-Session": "owner"},
    ).json()
    body = {"dataset_id": uploaded["dataset_id"]}
    assert (
        client.post("/api/analyze", json=body, headers={"X-Infera-Session": "other"}).status_code
        == 404
    )
    result = client.post("/api/analyze", json=body, headers={"X-Infera-Session": "owner"})
    assert result.status_code == 200, result.text
    assert "flag" in result.json()["schema"]["categorical_columns"]


def test_upload_size_and_request_validation(client, monkeypatch):
    monkeypatch.setattr(main, "MAX_FILE_SIZE_BYTES", 10)
    assert (
        client.post("/api/upload", files={"file": ("big.csv", b"x\n" + b"1\n" * 20)}).status_code
        == 413
    )
    assert client.post("/api/analyze", json={}).status_code == 422


def test_bounded_storage_and_local_access(client, monkeypatch):
    monkeypatch.setattr(main, "MAX_DATASETS", 1)
    first = client.post("/api/samples/housing/load").json()["dataset_id"]
    client.post("/api/samples/retail_sales/load")
    assert first not in main.DATASETS
    assert client.get("/health", headers={"origin": "https://evil.example"}).status_code == 403
    assert client.get("/health", headers={"host": "evil.example"}).status_code == 403
    assert client.get("/health", headers={"origin": "http://localhost:3000"}).status_code == 200
    main.ANALYSIS_LOCK.acquire()
    try:
        dataset_id = next(iter(main.DATASETS))
        assert client.post("/api/analyze", json={"dataset_id": dataset_id}).status_code == 429
    finally:
        main.ANALYSIS_LOCK.release()


def test_explorer_known_answers_and_validation(client):
    csv = "date,x,y,group\n2025-01-01,1,2,A\n2025-01-02,2,4,A\n2025-02-01,3,6,B\n2025-02-02,4,8,B"
    id = client.post("/api/upload", files={"file": ("data.csv", csv)}).json()["dataset_id"]
    base = {"dataset_id": id, "metric_column": "x"}
    grouped = client.post("/api/explore", json={**base, "mode": "group", "group_column": "group"})
    assert grouped.status_code == 200, grouped.text
    assert [g["value"] for g in grouped.json()["groups"]] == [1.5, 3.5]
    relationship = client.post(
        "/api/explore", json={**base, "mode": "relationship", "compare_column": "y"}
    ).json()
    assert relationship["pearson_r"] == pytest.approx(1)
    trend = client.post(
        "/api/explore", json={**base, "mode": "trend", "time_column": "date", "frequency": "M"}
    )
    assert trend.status_code == 200, trend.text
    assert [p["value"] for p in trend.json()["periods"]] == [1.5, 3.5]
    assert (
        client.post(
            "/api/explore", json={**base, "mode": "group", "group_column": "missing"}
        ).status_code
        == 400
    )
    options = client.post("/api/explore/options", json={"dataset_id": id, "column": "group"}).json()
    assert set(options["values"]) == {"A", "B"}
