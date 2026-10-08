"""Shared immediate profile used by both samples and uploaded files."""

import pandas as pd

from app.analysis.pipeline.runner import compute_health_score
from app.analysis.profiler.duplicates import analyze_duplicates
from app.analysis.profiler.missing import analyze_missing_values
from app.analysis.profiler.outliers import analyze_outliers
from app.analysis.profiler.schema import inspect_schema
from app.core.serialization import sanitize_for_json
from app.models.schemas import ColumnSummary, UploadResponse
from app.services.dataset_service import session_store


def profile_and_store(df: pd.DataFrame, name: str, owner: str, target: str | None = None) -> UploadResponse:
    schema = inspect_schema(df)
    missing = analyze_missing_values(df)
    duplicates = analyze_duplicates(df, schema.id_columns)
    outliers = analyze_outliers(df, schema.numerical_columns)
    return UploadResponse(
        dataset_id=session_store.put(df, name, owner),
        dataset_name=name,
        row_count=schema.row_count,
        column_count=schema.column_count,
        memory_formatted=schema.memory_formatted,
        health_score=compute_health_score(missing, duplicates, outliers),
        columns=[ColumnSummary(
            name=c.name, dtype=c.original_dtype, inferred_type=c.inferred_type,
            null_count=c.null_count, null_percentage=c.null_percentage,
            unique_count=c.unique_count, sample_values=sanitize_for_json(c.sample_values),
        ) for c in schema.columns],
        potential_targets=schema.potential_targets,
        recommended_target=target,
        preview_rows=sanitize_for_json(df.head(10).to_dict(orient="records")),
    )
