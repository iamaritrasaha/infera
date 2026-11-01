"""Infera — FastAPI Application Entry Point.

This module exposes the local HTTP endpoints for Infera:
- Health & Diagnostics (/health, /diagnostic)
- Sample Datasets (/api/samples)
- Dataset Upload (/api/upload)
- Analysis Pipeline (/api/analyze)
- Interactive Exploration (/api/explore)
- Results & Report Export (/api/results)
"""

import logging
import sys
import threading
import time
import uuid
from ipaddress import ip_address
from pathlib import Path
from typing import Any

import pandas as pd
from fastapi import FastAPI, File, Header, HTTPException, Query, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse, PlainTextResponse

from infera.analysis import run_full_analysis
from infera.data_loader import (
    MAX_FILE_SIZE_BYTES,
    calculate_health_score,
    get_dataset_schema,
    inspect_columns,
    load_csv,
    load_dataset,
    preview_records,
)
from infera.exploration import column_options, explore_dataframe
from infera.models import (
    AnalysisResponse,
    AnalyzeRequest,
    DiagnosticResponse,
    ExplorationOptionsRequest,
    ExplorationOptionsResponse,
    ExplorationResponse,
    ExploreRequest,
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
    description="A readable Python data science analysis engine.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "http://127.0.0.1:3100"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"],
)

DATASETS: dict[str, tuple[pd.DataFrame, str]] = {}
RESULTS: dict[str, dict[str, Any]] = {}
OWNERS: dict[str, str | None] = {}

ANALYSIS_LOCK = threading.Lock()
STORAGE_LOCK = threading.Lock()
MAX_DATASETS = 8
START_TIME = time.time()
SAMPLE_DATA_DIR = Path(__file__).resolve().parent.parent / "sample_data"


def store_dataset(dataset_id: str, df: pd.DataFrame, name: str, owner: str | None = None) -> None:
    """Store dataset in bounded FIFO cache; evict oldest when limit is reached."""
    with STORAGE_LOCK:
        while len(DATASETS) >= MAX_DATASETS:
            oldest = next(iter(DATASETS))
            DATASETS.pop(oldest, None)
            RESULTS.pop(oldest, None)
            OWNERS.pop(oldest, None)
        DATASETS[dataset_id] = (df, name)
        OWNERS[dataset_id] = owner


def check_owner(dataset_id: str, owner: str | None) -> None:
    """Validate that the requesting session owns the dataset."""
    if OWNERS.get(dataset_id) != owner:
        raise HTTPException(404, "Dataset unavailable in this browser session.")


def _build_upload_response(
    dataset_id: str,
    dataset_name: str,
    df: pd.DataFrame,
    recommended_target: str | None = None,
) -> UploadResponse:
    """Create an UploadResponse with schema metadata and JSON-safe preview rows."""
    schema_info = get_dataset_schema(df)
    health = calculate_health_score(df)
    potential_targets = schema_info["potential_targets"]
    recommended = recommended_target or (
        potential_targets[0]["column"] if potential_targets else None
    )

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
        preview_rows=preview_records(df),
    )


@app.middleware("http")
async def local_access_only(request, call_next):
    """Reject non-loopback hosts, clients, and foreign browser origins."""
    host = request.url.hostname
    client = request.client.host if request.client else ""

    def is_loopback(val: str | None) -> bool:
        if not val:
            return False
        try:
            return ip_address(val).is_loopback
        except ValueError:
            return val in {"localhost", "testclient", "testserver"}

    allowed_origins = {
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3100",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    }
    origin = request.headers.get("origin")
    if (
        not is_loopback(host)
        or not is_loopback(client)
        or (origin and origin not in allowed_origins)
    ):
        return JSONResponse(
            {"detail": "Infera supports local single-user access only."}, status_code=403
        )
    return await call_next(request)


# ---------------------------------------------------------------------------
# 1. Health & Diagnostics
# ---------------------------------------------------------------------------


@app.get("/health", response_model=HealthResponse)
@app.get("/api/health", response_model=HealthResponse)
def health_check() -> HealthResponse:
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
    return DiagnosticResponse(
        status="ok",
        project="Infera",
        version="0.5.0",
        uptime_seconds=round(time.time() - START_TIME, 1),
        python_version=sys.version.split()[0],
        environment="development",
    )


# ---------------------------------------------------------------------------
# 2. Sample Datasets
# ---------------------------------------------------------------------------

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
        name="Telecom Customer Churn",
        description="Analyze subscriber usage patterns, monthly fees, and contract duration.",
        row_count=1000,
        column_count=10,
        recommended_target="churned",
        suggested_problem_type="binary_classification",
    ),
    SampleDataset(
        id="student_performance",
        name="Student Exam Performance",
        description="Evaluate student study habits, test prep attendance, and final exam grades.",
        row_count=400,
        column_count=7,
        recommended_target="final_score",
        suggested_problem_type="regression",
    ),
    SampleDataset(
        id="retail_sales",
        name="Weekly Retail Sales",
        description="Store weekly revenue transactions across diverse retail departments.",
        row_count=800,
        column_count=6,
        recommended_target="weekly_sales",
        suggested_problem_type="regression",
    ),
]


@app.get("/api/samples", response_model=list[SampleDataset])
def list_sample_datasets() -> list[SampleDataset]:
    for item in SAMPLE_CATALOG:
        df = load_csv(SAMPLE_DATA_DIR / f"{item.id}.csv")
        item.row_count, item.column_count = df.shape
    return SAMPLE_CATALOG


@app.post("/api/samples/{sample_id}/load", response_model=UploadResponse)
def load_sample_dataset(
    sample_id: str, x_infera_session: str | None = Header(None)
) -> UploadResponse:
    catalog_item = next((s for s in SAMPLE_CATALOG if s.id == sample_id), None)
    csv_file = SAMPLE_DATA_DIR / f"{sample_id}.csv"
    if not catalog_item or not csv_file.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Sample dataset '{sample_id}' not found.",
        )

    df = load_csv(csv_file)
    dataset_id = str(uuid.uuid4())
    store_dataset(dataset_id, df, catalog_item.name, x_infera_session)
    return _build_upload_response(
        dataset_id, catalog_item.name, df, catalog_item.recommended_target
    )


# ---------------------------------------------------------------------------
# 3. Dataset Upload
# ---------------------------------------------------------------------------


@app.post("/api/upload", response_model=UploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_csv_file(
    file: UploadFile = File(...), x_infera_session: str | None = Header(None)
) -> UploadResponse:
    filename = file.filename or "dataset.csv"
    if Path(filename).suffix.lower() not in {".csv", ".xlsx", ".json", ".parquet"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Supported formats: CSV, XLSX, JSON, Parquet.",
        )

    try:
        content = await file.read(MAX_FILE_SIZE_BYTES + 1)
    except Exception as err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not read uploaded file: {err}",
        ) from err
    finally:
        await file.close()

    if len(content) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="The uploaded file is empty."
        )

    if len(content) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_CONTENT_TOO_LARGE,
            detail=f"File exceeds maximum upload size of {MAX_FILE_SIZE_BYTES // (1024 * 1024)} MB.",
        )

    try:
        df = load_dataset(content, filename)
    except ValueError as err:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(err)) from err

    dataset_name = Path(filename).stem.replace("_", " ")
    dataset_id = str(uuid.uuid4())
    store_dataset(dataset_id, df, dataset_name, x_infera_session)
    return _build_upload_response(dataset_id, dataset_name, df)


# ---------------------------------------------------------------------------
# 4. Run Analysis
# ---------------------------------------------------------------------------


@app.post("/api/analyze", response_model=AnalysisResponse)
def analyze_dataset(
    request: AnalyzeRequest, x_infera_session: str | None = Header(None)
) -> AnalysisResponse:
    check_owner(request.dataset_id, x_infera_session)
    entry = DATASETS.get(request.dataset_id)
    if not entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Dataset '{request.dataset_id}' not found. Please upload or reload your dataset.",
        )

    df, dataset_name = entry
    if not ANALYSIS_LOCK.acquire(blocking=False):
        raise HTTPException(429, "Another analysis is running. Please retry.")

    try:
        payload = run_full_analysis(
            df=df,
            dataset_name=dataset_name,
            dataset_id=request.dataset_id,
            user_target=request.target_column,
            focus=request.model_dump(),
        )
    except ValueError as err:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(err)) from err
    except Exception as err:
        logging.exception("Analysis failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Analysis failed. See the backend terminal for details.",
        ) from err
    finally:
        ANALYSIS_LOCK.release()

    with STORAGE_LOCK:
        if request.dataset_id in DATASETS:
            RESULTS[request.dataset_id] = payload

    return AnalysisResponse(**payload)


# ---------------------------------------------------------------------------
# 5. Interactive Exploration
# ---------------------------------------------------------------------------


@app.post("/api/explore/options", response_model=ExplorationOptionsResponse)
def exploration_options(
    request: ExplorationOptionsRequest, x_infera_session: str | None = Header(None)
):
    check_owner(request.dataset_id, x_infera_session)
    entry = DATASETS.get(request.dataset_id)
    if not entry:
        raise HTTPException(404, "Dataset unavailable. Please re-upload.")
    try:
        return ExplorationOptionsResponse(**column_options(entry[0], request.column))
    except ValueError as err:
        raise HTTPException(400, str(err)) from err


@app.post("/api/explore", response_model=ExplorationResponse)
def explore(request: ExploreRequest, x_infera_session: str | None = Header(None)):
    check_owner(request.dataset_id, x_infera_session)
    entry = DATASETS.get(request.dataset_id)
    if not entry:
        raise HTTPException(404, "Dataset unavailable. Please re-upload.")
    try:
        return ExplorationResponse(**explore_dataframe(entry[0], request))
    except ValueError as err:
        raise HTTPException(400, str(err)) from err


# ---------------------------------------------------------------------------
# 6. Results and Export
# ---------------------------------------------------------------------------


@app.get("/api/results/{dataset_id}", response_model=AnalysisResponse)
def get_analysis_results(
    dataset_id: str, x_infera_session: str | None = Header(None)
) -> AnalysisResponse:
    check_owner(dataset_id, x_infera_session)
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
    x_infera_session: str | None = Header(None),
):
    check_owner(dataset_id, x_infera_session)
    result = RESULTS.get(dataset_id)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No analysis results found for dataset '{dataset_id}'.",
        )

    reports = result.get("reports", {})
    if format == "html":
        return HTMLResponse(content=reports.get("html", "<p>Report unavailable.</p>"))
    return PlainTextResponse(
        content=reports.get("markdown", "Report unavailable."),
        media_type="text/markdown",
        headers={"Content-Disposition": 'attachment; filename="infera-report.md"'},
    )


if __name__ == "__main__":
    import uvicorn

    print("Starting Infera Data Analysis Engine on http://localhost:8000 ...")
    uvicorn.run("infera.main:app", host="127.0.0.1", port=8000, reload=True)
