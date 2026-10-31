"""Infera — FastAPI Application Entry Point.

This file starts the web service and exposes straightforward HTTP endpoints for:
1. Health checks (/health)
2. Loading sample datasets (/api/samples)
3. Uploading user CSV files (/api/upload)
4. Running data science analysis (/api/analyze)
5. Viewing and exporting results (/api/results)

A beginner can read this file from top to bottom to see how web requests are received,
handed to pure Python functions, and converted into JSON responses.
"""

import sys
import time
import uuid
from pathlib import Path
from typing import Any

import pandas as pd
from fastapi import FastAPI, File, HTTPException, Query, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, PlainTextResponse

from infera.analysis import run_full_analysis
from infera.data_loader import (
    MAX_FILE_SIZE_BYTES,
    calculate_health_score,
    get_dataset_schema,
    inspect_columns,
    load_csv,
)
from infera.models import (
    AnalysisResponse,
    AnalyzeRequest,
    DiagnosticResponse,
    HealthResponse,
    SampleDataset,
    UploadResponse,
)

# ---------------------------------------------------------------------------
# Application Setup & In-Memory Storage
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Infera",
    version="0.5.0",
    description="A readable, beginner-friendly Python data science analysis engine.",
)

# Allow the frontend (running on localhost:3000) to communicate with this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Open for easy local development
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# In-memory storage for active sessions:
# DATASETS maps dataset_id -> (pandas DataFrame, human-readable dataset name)
DATASETS: dict[str, tuple[pd.DataFrame, str]] = {}

# RESULTS maps dataset_id -> computed analysis payload dictionary
RESULTS: dict[str, dict[str, Any]] = {}

# Locate sample datasets folder relative to project root
SAMPLE_DATA_DIR = Path(__file__).resolve().parent.parent / "sample_data"
START_TIME = time.time()


# ---------------------------------------------------------------------------
# 1. Health & Diagnostic Endpoints
# ---------------------------------------------------------------------------


@app.get("/health", response_model=HealthResponse)
@app.get("/api/health", response_model=HealthResponse)
def health_check() -> HealthResponse:
    """Verify that the Infera server is up and responsive."""
    return HealthResponse(
        status="ok",
        project="Infera",
        version="0.5.0",
        engine_status="ready",
        timestamp=round(time.time(), 3),
    )


@app.get("/diagnostic", response_model=DiagnosticResponse)
@app.get("/api/diagnostic", response_model=DiagnosticResponse)
def diagnostic() -> DiagnosticResponse:
    """System diagnostics for local debugging without OS-specific dependencies."""
    uptime = time.time() - START_TIME
    return DiagnosticResponse(
        status="ok",
        project="Infera",
        version="0.5.0",
        uptime_seconds=round(uptime, 1),
        python_version=sys.version.split()[0],
        environment="development",
    )


# ---------------------------------------------------------------------------
# 2. Sample Datasets Catalog & Loader
# ---------------------------------------------------------------------------


# Pre-configured catalog of educational datasets included with the project
SAMPLE_CATALOG: list[SampleDataset] = [
    SampleDataset(
        id="housing",
        name="Housing Prices",
        description="Predict real estate sale prices using square footage, bedrooms, and location metrics.",
        row_count=500,
        column_count=8,
        recommended_target="price",
        suggested_problem_type="regression",
    ),
    SampleDataset(
        id="customer_churn",
        name="Customer Churn",
        description="Analyze subscriber usage patterns, monthly fees, and contract duration.",
        row_count=1000,
        column_count=10,
        recommended_target="churned",
        suggested_problem_type="binary_classification",
    ),
    SampleDataset(
        id="student_performance",
        name="Student Performance",
        description="Evaluate student study habits, test prep attendance, and final exam grades.",
        row_count=400,
        column_count=7,
        recommended_target="final_score",
        suggested_problem_type="regression",
    ),
    SampleDataset(
        id="retail_sales",
        name="Retail Sales",
        description="Store weekly revenue transactions across diverse retail departments.",
        row_count=800,
        column_count=6,
        recommended_target="weekly_sales",
        suggested_problem_type="regression",
    ),
]


@app.get("/api/samples", response_model=list[SampleDataset])
def list_sample_datasets() -> list[SampleDataset]:
    """List available sample datasets included in sample_data/."""
    return SAMPLE_CATALOG


@app.post("/api/samples/{sample_id}/load", response_model=UploadResponse)
def load_sample_dataset(sample_id: str) -> UploadResponse:
    """Load one of the bundled sample CSV files into the active session."""
    csv_file = SAMPLE_DATA_DIR / f"{sample_id}.csv"
    if not csv_file.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Sample dataset '{sample_id}' not found at {csv_file}.",
        )

    # Match metadata from catalog or fall back to capitalized id
    catalog_item = next((s for s in SAMPLE_CATALOG if s.id == sample_id), None)
    display_name = (
        catalog_item.name if catalog_item else sample_id.replace("_", " ").title()
    )

    df = load_csv(csv_file)
    dataset_id = str(uuid.uuid4())
    DATASETS[dataset_id] = (df, display_name)

    schema_info = get_dataset_schema(df)
    health = calculate_health_score(df)
    recommended = catalog_item.recommended_target if catalog_item else None

    return UploadResponse(
        dataset_id=dataset_id,
        dataset_name=display_name,
        row_count=len(df),
        column_count=len(df.columns),
        memory_formatted=schema_info["memory_formatted"],
        health_score=health,
        columns=inspect_columns(df),
        potential_targets=schema_info["potential_targets"],
        recommended_target=recommended,
        preview_rows=df.head(10).to_dict(orient="records"),
    )


# ---------------------------------------------------------------------------
# 3. CSV File Upload
# ---------------------------------------------------------------------------


@app.post(
    "/api/upload", response_model=UploadResponse, status_code=status.HTTP_201_CREATED
)
async def upload_csv_file(file: UploadFile = File(...)) -> UploadResponse:
    """Upload a CSV dataset from the user's computer.

    Execution Flow:
    1. Verify file name and extension (.csv)
    2. Read file contents and check size limit
    3. Parse into pandas DataFrame using data_loader.load_csv()
    4. Profile columns and store DataFrame in memory
    5. Return UploadResponse previewing columns and health
    """
    filename = file.filename or "dataset.csv"
    if not filename.lower().endswith(".csv"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Infera currently accepts CSV (.csv) files. Please upload a valid CSV.",
        )

    try:
        content = await file.read()
    except Exception as err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not read uploaded file: {err}",
        ) from err
    finally:
        await file.close()

    if len(content) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded file is empty.",
        )

    if len(content) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds maximum upload size of {MAX_FILE_SIZE_BYTES // (1024 * 1024)} MB.",
        )

    try:
        df = load_csv(content)
    except ValueError as err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(err)
        ) from err

    dataset_name = Path(filename).stem.replace("_", " ").title()
    dataset_id = str(uuid.uuid4())
    DATASETS[dataset_id] = (df, dataset_name)

    schema_info = get_dataset_schema(df)
    health = calculate_health_score(df)
    potential_targets = schema_info["potential_targets"]
    recommended = potential_targets[0]["column"] if potential_targets else None

    return UploadResponse(
        dataset_id=dataset_id,
        dataset_name=dataset_name,
        row_count=len(df),
        column_count=len(df.columns),
        memory_formatted=schema_info["memory_formatted"],
        health_score=health,
        columns=inspect_columns(df),
        potential_targets=potential_targets,
        recommended_target=recommended,
        preview_rows=df.head(10).to_dict(orient="records"),
    )


# ---------------------------------------------------------------------------
# 4. Run Analysis
# ---------------------------------------------------------------------------


@app.post("/api/analyze", response_model=AnalysisResponse)
def analyze_dataset(request: AnalyzeRequest) -> AnalysisResponse:
    """Execute complete analytical and machine learning pipeline on an uploaded dataset.

    Execution Flow:
    1. Fetch DataFrame from in-memory DATASETS
    2. Pass to infera.analysis.run_full_analysis()
    3. Cache result in RESULTS dictionary
    4. Return full AnalysisResponse
    """
    entry = DATASETS.get(request.dataset_id)
    if not entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Dataset '{request.dataset_id}' not found. Please upload or reload your dataset.",
        )

    df, dataset_name = entry

    try:
        analysis_payload = run_full_analysis(
            df=df,
            dataset_name=dataset_name,
            dataset_id=request.dataset_id,
            user_target=request.target_column,
        )
    except ValueError as err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(err)
        ) from err
    except Exception as err:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Analysis encountered an error: {err}",
        ) from err

    # Cache result for future lookups or report downloads
    RESULTS[request.dataset_id] = analysis_payload

    return AnalysisResponse(**analysis_payload)


# ---------------------------------------------------------------------------
# 5. Retrieve Results and Download Reports
# ---------------------------------------------------------------------------


@app.get("/api/results/{dataset_id}", response_model=AnalysisResponse)
def get_analysis_results(dataset_id: str) -> AnalysisResponse:
    """Retrieve previously calculated analysis results for a dataset."""
    result = RESULTS.get(dataset_id)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No analysis results found for dataset '{dataset_id}'. Run /api/analyze first.",
        )
    return AnalysisResponse(**result)


@app.get("/api/results/{dataset_id}/report")
def download_analysis_report(
    dataset_id: str,
    format: str = Query(default="markdown", pattern="^(markdown|html)$"),
):
    """Download an executive report in Markdown or HTML format."""
    result = RESULTS.get(dataset_id)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No analysis results found for dataset '{dataset_id}'.",
        )

    reports = result.get("reports", {})
    if format == "html":
        return HTMLResponse(content=reports.get("html", "<p>Report unavailable.</p>"))
    return PlainTextResponse(content=reports.get("markdown", "Report unavailable."))


# ---------------------------------------------------------------------------
# Local Development Runner
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn

    print("Starting Infera Data Analysis Engine on http://localhost:8000 ...")
    uvicorn.run("infera.main:app", host="0.0.0.0", port=8000, reload=True)
