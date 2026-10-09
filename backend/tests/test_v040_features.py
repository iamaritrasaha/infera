"""Tests for Infera v0.4.0 reliability, observability, goals, and insight discovery."""

import numpy as np
import pandas as pd
from fastapi.testclient import TestClient

from app.analysis.insights.discovery import discover_insights
from app.main import app

client = TestClient(app)


def test_health_check_v040():
    """Verify v0.4.0 health endpoint structure and latency."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["project"] == "Infera"
    assert data["version"] == "0.4.0"
    assert data["engine_status"] == "ready"
    assert "timestamp" in data
    assert "X-Request-ID" in response.headers
    assert "X-Response-Time-Ms" in response.headers


def test_diagnostic_endpoint_safe_telemetry():
    """Verify diagnostic endpoint exposes operational stats without private data."""
    response = client.get("/api/diagnostic")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["version"] == "0.4.0"
    assert data["uptime_seconds"] >= 0.0
    assert "python_version" in data
    assert data["max_concurrent_analyses"] == 1
    # Verify no sensitive keys leaked
    assert "SECRET" not in data
    assert "data" not in data


def test_goal_trends_no_date_gives_clear_explanation():
    """Selecting trends on dataset without dates should not invent chronology."""
    df = pd.DataFrame({
        "revenue": [100.0, 200.0, 150.0, 300.0, 250.0, 400.0, 350.0, 500.0],
        "category": ["A", "B", "A", "B", "A", "B", "A", "B"],
    })
    result = discover_insights(
        df,
        "NoDateDataset",
        numerical_columns=["revenue"],
        categorical_columns=["category"],
        datetime_columns=[],
        id_columns=[],
        constant_columns=[],
        goal="trends",
    )
    assert "No date/time column detected" in result["status"]
    # Ensure no fabricated time candidates were returned
    for finding in result["key_findings"]:
        assert finding["category"] != "time"


def test_unusual_observations_candidate():
    """Verify detection of outliers using 1.5x IQR fence."""
    values = [50.0] * 30 + [52.0] * 30 + [48.0] * 30 + [500.0, 520.0, 490.0]  # 3 clear outliers
    df = pd.DataFrame({"score": values})
    result = discover_insights(
        df,
        "OutlierData",
        numerical_columns=["score"],
        categorical_columns=[],
        datetime_columns=[],
        id_columns=[],
        constant_columns=[],
        question="distributions",
    )
    finding_ids = [f["id"] for f in result["key_findings"]]
    assert "unusual-observations" in finding_ids
    outlier_finding = next(f for f in result["key_findings"] if f["id"] == "unusual-observations")
    assert outlier_finding["evidence"]["outlier_count"] == 3
    assert outlier_finding["finding_type"] == "observed"


def test_category_pareto_concentration_candidate():
    """Verify top category Pareto concentration finding."""
    # Top 2 categories constitute 80 of 100 rows (80%)
    categories = ["Tier1"] * 50 + ["Tier2"] * 30 + ["Tier3"] * 10 + ["Tier4"] * 10
    df = pd.DataFrame({"tier": categories})
    result = discover_insights(
        df,
        "ParetoData",
        numerical_columns=[],
        categorical_columns=["tier"],
        datetime_columns=[],
        id_columns=[],
        constant_columns=[],
        goal="compare_groups",
    )
    finding_ids = [f["id"] for f in result["key_findings"]]
    assert "category-concentration" in finding_ids
    conc_finding = next(f for f in result["key_findings"] if f["id"] == "category-concentration")
    assert conc_finding["evidence"]["top_k_count"] == 2
    assert conc_finding["evidence"]["concentration_percentage"] == 80.0


def test_model_feature_importance_candidate():
    """Verify top model features insight is surfaced when models exist."""
    df = pd.DataFrame({"x1": np.arange(50, dtype=float), "y": np.arange(50, dtype=float) * 2})
    mock_modeling = {
        "target_column": "y",
        "test_samples": 40,
        "cv_folds": 5,
        "summary_table": [{"model": "Linear", "r2": 0.95, "is_best": True}, {"model": "Baseline", "r2": 0.0}],
        "models": [
            {
                "model_name": "LinearRegression",
                "display_name": "Linear Regression",
                "is_best_model": True,
                "feature_importances": [
                    {"feature": "x1", "importance": 0.85},
                    {"feature": "x2", "importance": 0.15},
                ],
            }
        ],
    }
    result = discover_insights(
        df,
        "ModelData",
        numerical_columns=["x1", "y"],
        categorical_columns=[],
        datetime_columns=[],
        id_columns=[],
        constant_columns=[],
        target_column="y",
        goal="predict_outcome",
        modeling=mock_modeling,
    )
    finding_ids = [f["id"] for f in result["key_findings"]]
    assert "model-top-features" in finding_ids
    feat_finding = next(f for f in result["key_findings"] if f["id"] == "model-top-features")
    assert feat_finding["evidence"]["top_feature"] == "x1"
    assert feat_finding["finding_type"] == "prediction"
