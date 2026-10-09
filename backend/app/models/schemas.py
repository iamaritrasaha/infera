"""Pydantic schemas for API request and response serialization."""

from typing import Any, Literal

from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    """Health check response."""

    status: str
    project: str
    version: str
    engine_status: str = "ready"
    timestamp: float | None = None


class DiagnosticResponse(BaseModel):
    """Operational telemetry and health statistics."""

    status: str
    project: str
    version: str
    uptime_seconds: float
    memory_mb: float | None = None
    python_version: str
    max_concurrent_analyses: int
    environment: str


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
    recommended_target: str | None = None
    preview_rows: list[dict[str, Any]]


class AnalyzeRequest(BaseModel):
    """Request to initiate full pipeline analysis."""

    dataset_id: str = Field(
        ...,
        pattern=r"^[a-zA-Z0-9_\-]{8,64}$",
        description="Unique dataset session ID (UUID or safe token)",
    )
    target_column: str | None = Field(
        None,
        max_length=100,
        description="Optional user-selected target column",
    )
    metric_column: str | None = Field(None, max_length=100)
    date_column: str | None = Field(None, max_length=100)
    group_column: str | None = Field(None, max_length=100)
    question: str = "automatic"
    goal: str | None = Field(None, max_length=64, description="Optional high-level analytical goal")


class InsightPoint(BaseModel):
    x: str | float
    y: float
    detail: str | None = None


class InsightChart(BaseModel):
    kind: Literal["line", "bar", "histogram", "scatter"]
    title: str
    x_label: str
    y_label: str
    points: list[InsightPoint]


class KeyFinding(BaseModel):
    id: str
    category: str
    finding_type: str
    title: str
    summary: str
    interpretation: str
    limitation: str
    confidence: Literal["high", "moderate", "exploratory"]
    evidence: dict[str, Any]
    chart: InsightChart | None = None


class ImportantMetric(BaseModel):
    label: str
    value: str
    detail: str


class InsightFocus(BaseModel):
    metric_column: str | None = None
    date_column: str | None = None
    group_column: str | None = None
    question: str


class InsightOptions(BaseModel):
    metric_columns: list[str]
    date_columns: list[str]
    group_columns: list[str]


class InsightDiscovery(BaseModel):
    dataset_overview: str
    status: str
    selected_focus: InsightFocus
    goal: str | None = None
    options: InsightOptions
    important_metrics: list[ImportantMetric]
    key_findings: list[KeyFinding]
    suggested_questions: list[str]


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
    insight_discovery: InsightDiscovery
    preview_rows: list[dict[str, Any]] | None = None
    reports: dict[str, str]

    model_config = {"populate_by_name": True}
