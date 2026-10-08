"""Dataset upload, immediate profiling, and session instantiation."""

from fastapi import APIRouter, File, HTTPException, UploadFile, status

from app.analysis.pipeline.runner import compute_health_score
from app.analysis.profiler.duplicates import analyze_duplicates
from app.analysis.profiler.missing import analyze_missing_values
from app.analysis.profiler.outliers import analyze_outliers
from app.analysis.profiler.schema import inspect_schema
from app.models.schemas import ColumnSummary, UploadResponse
from app.services.dataset_service import parse_dataset_bytes, session_store

router = APIRouter(prefix="/api", tags=["Upload"])


@router.post("/upload", response_model=UploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_dataset(file: UploadFile = File(...)) -> UploadResponse:
    """Accepts CSV/XLSX/JSON/Parquet files, validates, profiles immediately, and returns summary."""
    filename = file.filename or "uploaded_dataset.csv"
    try:
        content = await file.read()
        df = parse_dataset_bytes(content, filename)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred while processing the file: {e!s}",
        )
    finally:
        await file.close()

    # Instant schema and quality profiling
    schema = inspect_schema(df)
    missing = analyze_missing_values(df)
    duplicates = analyze_duplicates(df, id_columns=schema.id_columns)
    outliers = analyze_outliers(df, schema.numerical_columns)
    health_score = compute_health_score(missing, duplicates, outliers)

    # Store in session
    dataset_name = filename.rsplit(".", 1)[0]
    dataset_id = session_store.put(df, dataset_name)

    # Build column previews
    columns_summary: list[ColumnSummary] = []
    for c in schema.columns:
        columns_summary.append(
            ColumnSummary(
                name=c.name,
                dtype=c.original_dtype,
                inferred_type=c.inferred_type,
                null_count=c.null_count,
                null_percentage=c.null_percentage,
                unique_count=c.unique_count,
                sample_values=c.sample_values,
            )
        )

    # Preview rows (up to 10 rows)
    preview_df = df.head(10).fillna("").copy()
    preview_rows = preview_df.to_dict(orient="records")

    return UploadResponse(
        dataset_id=dataset_id,
        dataset_name=dataset_name,
        row_count=schema.row_count,
        column_count=schema.column_count,
        memory_formatted=schema.memory_formatted,
        health_score=health_score,
        columns=columns_summary,
        potential_targets=schema.potential_targets,
        preview_rows=preview_rows,
    )
