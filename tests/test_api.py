"""Tests for Infera FastAPI endpoints."""

from fastapi.testclient import TestClient

from infera.main import app

client = TestClient(app)


def test_health_endpoint():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["app"] == "infera"


def test_upload_csv_success():
    csv_content = "feature_x,feature_y,target\n" + "\n".join(
        f"{i},{i * 2},{i * 3 + 1}" for i in range(25)
    )
    files = {"file": ("test_dataset.csv", csv_content.encode("utf-8"), "text/csv")}
    response = client.post("/api/upload", files=files)
    assert response.status_code == 201
    data = response.json()
    assert "dataset_id" in data
    assert data["filename"] == "test_dataset.csv"
    assert data["summary"]["row_count"] == 25
    assert len(data["correlations"]["pairs"]) > 0


def test_upload_csv_invalid_extension():
    files = {"file": ("data.json", b'{"key": "value"}', "application/json")}
    response = client.post("/api/upload", files=files)
    assert response.status_code == 400
    assert "Only CSV files" in response.json()["detail"]


def test_upload_csv_empty():
    files = {"file": ("empty.csv", b"", "text/csv")}
    response = client.post("/api/upload", files=files)
    assert response.status_code == 400
    assert "empty" in response.json()["detail"].lower()


def test_sample_dataset_endpoint():
    response = client.post("/api/sample")
    assert response.status_code == 201
    data = response.json()
    assert data["filename"] == "sample_housing.csv"
    assert data["summary"]["row_count"] == 120
    assert "price" in data["summary"]["statistics"]


def test_regression_endpoint():
    # 1. Load sample dataset
    sample_res = client.post("/api/sample")
    dataset_id = sample_res.json()["dataset_id"]

    # 2. Run regression
    reg_res = client.post(
        "/api/regression",
        json={"dataset_id": dataset_id, "target_column": "price"},
    )
    assert reg_res.status_code == 200
    data = reg_res.json()
    assert data["target_column"] == "price"
    assert "r2" in data["metrics"]
    assert "mae" in data["metrics"]
    assert len(data["coefficients"]) == 3
    assert len(data["chart_points"]) > 0


def test_regression_not_found():
    res = client.post(
        "/api/regression",
        json={"dataset_id": "non-existent-id", "target_column": "price"},
    )
    assert res.status_code == 404


def test_report_download():
    # 1. Load sample and run regression
    sample_res = client.post("/api/sample")
    dataset_id = sample_res.json()["dataset_id"]
    client.post(
        "/api/regression",
        json={"dataset_id": dataset_id, "target_column": "price"},
    )

    # 2. Fetch report
    rep_res = client.get(f"/api/report/{dataset_id}")
    assert rep_res.status_code == 200
    assert "text/markdown" in rep_res.headers["content-type"]
    assert "Linear Regression Results" in rep_res.text
    assert "sample_housing.csv" in rep_res.text
