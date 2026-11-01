"""Main FastAPI application for Infera.

Exposes endpoints for:
1. Health check (/api/health)
2. Uploading and profiling a CSV dataset (/api/upload)
3. Loading a built-in sample dataset (/api/sample)
4. Training a simple Linear Regression model (/api/regression)
5. Downloading a Markdown analysis report (/api/report/{dataset_id})
"""

from __future__ import annotations

import uuid
from typing import Any

import numpy as np
import pandas as pd
from fastapi import FastAPI, File, HTTPException, Response, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from infera.analysis import (
    compute_correlations,
    compute_summary,
    generate_markdown_report,
    read_csv,
)
from infera.ml import train_linear_regression

app = FastAPI(
    title="Infera",
    description="Python Data Analysis and Machine Learning Engine",
    version="0.6.0",
)

# Allow CORS for local frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory dataset cache: dataset_id -> { "filename": str, "df": DataFrame, "summary": dict, "correlations": dict, "regression": dict | None }
DATASET_STORE: dict[str, dict[str, Any]] = {}
MAX_STORE_DATASETS = 20


def _save_dataset(
    filename: str,
    df: pd.DataFrame,
    summary: dict[str, Any],
    correlations: dict[str, Any],
) -> str:
    """Store dataset in memory and evict the oldest if cache exceeds limit."""
    if len(DATASET_STORE) >= MAX_STORE_DATASETS:
        oldest_key = next(iter(DATASET_STORE))
        DATASET_STORE.pop(oldest_key, None)

    dataset_id = str(uuid.uuid4())
    DATASET_STORE[dataset_id] = {
        "filename": filename,
        "df": df,
        "summary": summary,
        "correlations": correlations,
        "regression": None,
    }
    return dataset_id


class RegressionRequest(BaseModel):
    dataset_id: str
    target_column: str
    feature_columns: list[str] | None = None


@app.get("/api/health")
@app.get("/health")
def health_check() -> dict[str, str]:
    """Health check endpoint to verify backend status."""
    return {"status": "ok", "app": "infera"}


@app.post("/api/upload", status_code=status.HTTP_201_CREATED)
async def upload_csv(file: UploadFile = File(...)) -> dict[str, Any]:
    """Upload a CSV file, profile its columns, and compute correlations."""
    filename = file.filename or "uploaded.csv"
    if not filename.lower().endswith(".csv"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only CSV files (.csv) are supported.",
        )

    content = await file.read()
    try:
        df = read_csv(content, filename=filename)
        summary = compute_summary(df)
        correlations = compute_correlations(df)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    dataset_id = _save_dataset(filename, df, summary, correlations)

    return {
        "dataset_id": dataset_id,
        "filename": filename,
        "summary": summary,
        "correlations": correlations,
    }


@app.post("/api/sample", status_code=status.HTTP_201_CREATED)
def load_sample_dataset() -> dict[str, Any]:
    """Generate a realistic sample housing dataset for immediate testing."""
    np.random.seed(42)
    n = 120
    rooms = np.random.uniform(3.0, 9.0, size=n).round(1)
    age = np.random.uniform(1.0, 50.0, size=n).round(1)
    distance = np.random.uniform(1.0, 15.0, size=n).round(2)
    # Price = 50 + 25 * rooms - 0.8 * age - 2.0 * distance + noise
    price = (
        50.0 + 25.0 * rooms - 0.8 * age - 2.0 * distance + np.random.normal(0, 10, size=n)
    ).round(2)

    df = pd.DataFrame(
        {
            "rooms": rooms,
            "age": age,
            "distance": distance,
            "price": price,
        }
    )

    summary = compute_summary(df)
    correlations = compute_correlations(df)
    dataset_id = _save_dataset("sample_housing.csv", df, summary, correlations)

    return {
        "dataset_id": dataset_id,
        "filename": "sample_housing.csv",
        "summary": summary,
        "correlations": correlations,
    }


@app.post("/api/regression")
def run_regression(req: RegressionRequest) -> dict[str, Any]:
    """Train a Linear Regression model on a stored dataset."""
    item = DATASET_STORE.get(req.dataset_id)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dataset not found or session expired. Please re-upload your file.",
        )

    try:
        result = train_linear_regression(
            df=item["df"],
            target_column=req.target_column,
            feature_columns=req.feature_columns,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    # Cache regression result for report export
    item["regression"] = result

    return result


@app.get("/api/report/{dataset_id}")
def download_report(dataset_id: str) -> Response:
    """Download a Markdown analysis report for the dataset."""
    item = DATASET_STORE.get(dataset_id)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dataset not found. Please upload a dataset first.",
        )

    report_content = generate_markdown_report(
        filename=item["filename"],
        summary=item["summary"],
        correlations=item["correlations"],
        regression=item.get("regression"),
    )

    clean_name = item["filename"].replace(".csv", "")
    return Response(
        content=report_content,
        media_type="text/markdown",
        headers={
            "Content-Disposition": f'attachment; filename="infera-{clean_name}-report.md"',
        },
    )
