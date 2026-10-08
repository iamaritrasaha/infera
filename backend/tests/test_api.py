"""Integration tests for FastAPI endpoints."""

from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app, headers={"X-Infera-Session": "a" * 64})
SAMPLE_DIR = Path(__file__).resolve().parent.parent.parent / "sample_data"


def test_health_check():
    """Verify health endpoint."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["project"] == "Infera"


def test_list_samples():
    """Verify samples catalog endpoint."""
    response = client.get("/api/samples")
    assert response.status_code == 200
    samples = response.json()
    assert len(samples) >= 4
    sample_ids = [s["id"] for s in samples]
    assert "housing" in sample_ids
    assert "customer_churn" in sample_ids


def test_load_sample_and_analyze():
    """Verify loading sample dataset, running analysis, and fetching results."""
    # 1. Load sample dataset
    load_res = client.post("/api/samples/housing/load")
    assert load_res.status_code == 200
    upload_data = load_res.json()
    assert "dataset_id" in upload_data
    assert upload_data["dataset_name"] == "Housing Prices"
    assert upload_data["row_count"] > 100
    dataset_id = upload_data["dataset_id"]

    # 2. Run analysis
    analyze_res = client.post(
        "/api/analyze", json={"dataset_id": dataset_id, "target_column": "price"}
    )
    assert analyze_res.status_code == 200
    analysis_data = analyze_res.json()
    assert analysis_data["dataset_id"] == dataset_id
    assert analysis_data["health_score"] > 50
    assert analysis_data["problem_detection"]["problem_type"] == "regression"
    assert analysis_data["modeling"] is not None
    assert len(analysis_data["modeling"]["models"]) >= 4

    # 3. Retrieve results from cache
    get_res = client.get(f"/api/results/{dataset_id}")
    assert get_res.status_code == 200

    # 4. Download report
    report_res = client.get(f"/api/results/{dataset_id}/report?format=markdown")
    assert report_res.status_code == 200
    assert "INFERA DATA SCIENCE EVIDENCE REPORT" in report_res.text


def test_upload_csv_file():
    """Verify direct CSV file upload."""
    csv_path = SAMPLE_DIR / "customer_churn.csv"
    with open(csv_path, "rb") as f:
        response = client.post(
            "/api/upload",
            files={"file": ("churn_test.csv", f, "text/csv")},
        )
    assert response.status_code == 201
    data = response.json()
    assert "dataset_id" in data
    assert data["row_count"] > 100
    assert len(data["columns"]) > 5


def test_upload_empty_file_rejected():
    """Verify empty file is rejected with 400 Bad Request."""
    response = client.post(
        "/api/upload",
        files={"file": ("empty.csv", b"", "text/csv")},
    )
    assert response.status_code == 400
