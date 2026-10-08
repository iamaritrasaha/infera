"""Pydantic schemas for API request and response serialization."""

from typing import Any

from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    """Health check response."""

    status: str
    project: str
    version: str


class SampleDatasetInfo(BaseModel):
    """Metadata for a pre-packaged sample dataset."""

    id: str
    name: str
    description: str
    row_count: int
    column_count: int
    recommended_target: str
    suggested_problem_type: str


class ColumnSummary(BaseModel):
    """Column overview in upload preview."""

    name: str
    dtype: str
    inferred_type: str
    null_count: int
    null_percentage: float
    unique_count: int
    sample_values: list[Any]


class UploadResponse(BaseModel):
    """Initial upload and profiling response."""

    dataset_id: str
    dataset_name: str
    row_count: int
    column_count: int
    memory_formatted: str
    health_score: int
    columns: list[ColumnSummary]
    potential_targets: list[dict[str, str]]
    preview_rows: list[dict[str, Any]]


class AnalyzeRequest(BaseModel):
    """Request to initiate full pipeline analysis."""

    dataset_id: str = Field(..., description="Unique dataset session ID")
    target_column: str | None = Field(None, description="Optional user-selected target column")


class AnalysisResponse(BaseModel):
    """Complete analysis and benchmark payload."""

    dataset_id: str
    dataset_name: str
    health_score: int
    schema_info: dict[str, Any] = Field(..., alias="schema")
    quality: dict[str, Any]
    descriptive_statistics: dict[str, Any]
    correlations: dict[str, Any]
    hypothesis_tests: list[dict[str, Any]]
    problem_detection: dict[str, Any]
    plan: dict[str, Any]
    modeling: dict[str, Any] | None = None
    clustering: dict[str, Any] | None = None
    pca: dict[str, Any] | None = None
    timeseries: dict[str, Any] | None = None
    insights: list[dict[str, Any]]
    preview_rows: list[dict[str, Any]] | None = None
    reports: dict[str, str]

    model_config = {"populate_by_name": True}
