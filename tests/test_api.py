"""Integration tests for Infera FastAPI endpoints.

Demonstrates:
1. Health and diagnostics endpoints.
2. Listing and loading sample datasets.
3. Uploading a custom CSV file.
4. Running the full analysis pipeline via HTTP POST.
5. Retrieving cached results and downloading Markdown reports.
"""

from pathlib import Path

from fastapi.testclient import TestClient

from infera.main import app

client = TestClient(app)
SAMPLE_DIR = Path(__file__).resolve().parent.parent / "sample_data"


def test_health_check_endpoint():
    """Verify service health endpoint returns 200 OK."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["project"] == "Infera"


def test_diagnostic_endpoint():
    """Verify diagnostic endpoint returns uptime and Python version without crashing."""
    response = client.get("/diagnostic")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "python_version" in data


def test_list_sample_datasets():
    """Verify listing bundled sample datasets."""
    response = client.get("/api/samples")
    assert response.status_code == 200
    samples = response.json()
    assert len(samples) >= 4
    sample_ids = [s["id"] for s in samples]
    assert "housing" in sample_ids
    assert "customer_churn" in sample_ids


def test_load_sample_and_run_analysis():
    """Verify end-to-end flow: load sample -> analyze -> get results -> download report."""
    # 1. Load sample dataset
    load_res = client.post("/api/samples/housing/load")
    assert load_res.status_code == 200
    load_data = load_res.json()
    assert "dataset_id" in load_data
    assert load_data["row_count"] > 100
    dataset_id = load_data["dataset_id"]

    # 2. Run analysis
    analyze_res = client.post(
        "/api/analyze",
        json={"dataset_id": dataset_id, "target_column": "price"},
    )
    assert analyze_res.status_code == 200
    analysis = analyze_res.json()
    assert analysis["dataset_id"] == dataset_id
    assert analysis["health_score"] > 50
    assert analysis["problem_detection"]["problem_type"] == "regression"
    assert analysis["modeling"] is not None
    assert len(analysis["modeling"]["models"]) >= 2

    # 3. Retrieve analysis from cache
    get_res = client.get(f"/api/results/{dataset_id}")
    assert get_res.status_code == 200
    assert get_res.json()["dataset_id"] == dataset_id

    # 4. Download Markdown report
    report_res = client.get(f"/api/results/{dataset_id}/report?format=markdown")
    assert report_res.status_code == 200
    assert "INFERA DATA SCIENCE EVIDENCE REPORT" in report_res.text


def test_upload_csv_file():
    """Verify uploading a CSV directly via multipart form."""
    csv_bytes = b"feature_a,feature_b,target\n1,10,100\n2,20,200\n3,30,300\n4,40,400\n"
    response = client.post(
        "/api/upload",
        files={"file": ("test_upload.csv", csv_bytes, "text/csv")},
    )
    assert response.status_code == 201
    data = response.json()
    assert "dataset_id" in data
    assert data["row_count"] == 4
    assert data["column_count"] == 3


def test_upload_empty_csv_rejected():
    """Verify that uploading an empty CSV returns 400 Bad Request."""
    response = client.post(
        "/api/upload",
        files={"file": ("empty.csv", b"", "text/csv")},
    )
    assert response.status_code == 400
    assert "empty" in response.json()["detail"].lower()
