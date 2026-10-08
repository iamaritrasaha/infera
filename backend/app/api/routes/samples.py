"""Sample dataset endpoints enabling zero-setup instant exploration."""

from fastapi import APIRouter, HTTPException, status

from app.analysis.pipeline.runner import compute_health_score
from app.analysis.profiler.duplicates import analyze_duplicates
from app.analysis.profiler.missing import analyze_missing_values
from app.analysis.profiler.outliers import analyze_outliers
from app.analysis.profiler.schema import inspect_schema
from app.models.schemas import ColumnSummary, SampleDatasetInfo, UploadResponse
from app.services.dataset_service import get_sample_datasets, load_sample_dataset, session_store

router = APIRouter(prefix="/api/samples", tags=["Sample Datasets"])


@router.get("", response_model=list[SampleDatasetInfo])
def list_sample_datasets() -> list[SampleDatasetInfo]:
    """Returns catalogue of built-in sample datasets."""
    samples = get_sample_datasets()
    res = []
    for s in samples:
        res.append(
            SampleDatasetInfo(
                id=s["id"],
                name=s["name"],
                description=s["description"],
                row_count=250,  # approximate
                column_count=10,
                recommended_target=s["recommended_target"],
                suggested_problem_type=s["suggested_problem_type"],
            )
        )
    return res


@router.post("/{sample_id}/load", response_model=UploadResponse)
def load_sample(sample_id: str) -> UploadResponse:
    """Loads a sample dataset directly into an active session and returns profiling overview."""
    try:
        df, dataset_name = load_sample_dataset(sample_id)
    except (ValueError, FileNotFoundError) as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

    # Instant schema and quality profiling
    schema = inspect_schema(df)
    missing = analyze_missing_values(df)
    duplicates = analyze_duplicates(df, id_columns=schema.id_columns)
    outliers = analyze_outliers(df, schema.numerical_columns)
    health_score = compute_health_score(missing, duplicates, outliers)

    # Store in session
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
