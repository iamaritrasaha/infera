"""Data models for Infera.

These Pydantic models define the structured inputs and outputs for the
application. Beginners can look here to understand the exact shape of
the data moving into and out of the API.
"""

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

# ---------------------------------------------------------------------------
# Health and Diagnostics
# ---------------------------------------------------------------------------


class HealthResponse(BaseModel):
    """Basic health status of the application."""

    status: str = Field(default="ok", description="Overall service status")
    project: str = Field(default="Infera", description="Project name")
    version: str = Field(default="0.5.0", description="Current application version")
    engine_status: str = Field(default="ready", description="Analysis engine state")
    timestamp: float = Field(default=0.0, description="Unix timestamp of the response")


class DiagnosticResponse(BaseModel):
    """System information useful for troubleshooting."""

    status: str = "ok"
    project: str = "Infera"
    version: str = "0.5.0"
    uptime_seconds: float = 0.0
    python_version: str = ""
    environment: str = "development"
    max_concurrent_analyses: int = 1


# ---------------------------------------------------------------------------
# Column & Schema Information
# ---------------------------------------------------------------------------


class ColumnSummary(BaseModel):
    """Summary of a single column's data type, missing values, and samples."""

    name: str
    dtype: str
    original_dtype: str | None = None
    inferred_type: str  # "numerical", "categorical", "datetime", "text", "boolean"
    null_count: int
    null_percentage: float
    unique_count: int
    sample_values: list[Any]


class PotentialTarget(BaseModel):
    """A column that may be suitable as a machine learning prediction target."""

    column: str
    suggested_type: str  # e.g. "regression" or "classification"


class SampleDataset(BaseModel):
    """Metadata describing a pre-loaded sample dataset."""

    id: str
    name: str
    description: str
    row_count: int
    column_count: int
    recommended_target: str
    suggested_problem_type: str


# ---------------------------------------------------------------------------
# Upload & Request Models
# ---------------------------------------------------------------------------


class UploadResponse(BaseModel):
    """Returned after a CSV file is successfully uploaded and initially inspected."""

    dataset_id: str
    dataset_name: str
    row_count: int
    column_count: int
    memory_formatted: str
    health_score: int
    columns: list[ColumnSummary]
    potential_targets: list[PotentialTarget]
    recommended_target: str | None = None
    preview_rows: list[dict[str, Any]]


class AnalyzeRequest(BaseModel):
    """Parameters sent by the user to trigger dataset analysis."""

    dataset_id: str
    target_column: str | None = None
    metric_column: str | None = None
    date_column: str | None = None
    group_column: str | None = None
    question: str = "automatic"
    goal: str | None = None


# ---------------------------------------------------------------------------
# Descriptive Statistics
# ---------------------------------------------------------------------------


class HistogramBin(BaseModel):
    """A single bucket in a numerical histogram."""

    bin_start: float
    bin_end: float
    count: int
    label: str


class NumericalColumnStats(BaseModel):
    """Detailed statistical measurements for a single numerical column."""

    column: str
    count: int
    null_count: int
    mean: float | None
    median: float | None
    std: float | None
    variance: float | None
    min: float | None
    max: float | None
    q25: float | None
    q75: float | None
    iqr: float | None
    skewness: float | None
    skewness_interpretation: str
    kurtosis: float | None
    kurtosis_interpretation: str
    histogram: list[HistogramBin]


class CategoryFrequency(BaseModel):
    """The count and percentage of occurrences for one distinct category."""

    category: str
    count: int
    percentage: float


class CategoricalColumnStats(BaseModel):
    """Distribution measurements for a single categorical or text column."""

    column: str
    total_count: int
    null_count: int
    unique_count: int
    mode: str
    mode_frequency: int
    mode_percentage: float
    is_imbalanced: bool
    frequencies: list[CategoryFrequency]


class DescriptiveStatistics(BaseModel):
    """Container grouping numerical and categorical statistical calculations."""

    numerical: list[NumericalColumnStats]
    categorical: list[CategoricalColumnStats]


# ---------------------------------------------------------------------------
# Correlations
# ---------------------------------------------------------------------------


class CorrelationPair(BaseModel):
    """Relationship between two numerical variables."""

    feature_a: str
    feature_b: str
    pearson_r: float
    pearson_p_value: float
    spearman_rho: float
    spearman_p_value: float
    strength: str  # "strong", "moderate", "weak", "negligible"
    direction: str  # "positive", "negative", "neutral"
    is_statistically_significant: bool
    plain_english: str
    evidence_summary: dict[str, Any] = Field(default_factory=dict)


class CorrelationResult(BaseModel):
    """Complete correlation matrices and list of top relationships."""

    columns: list[str]
    pearson_matrix: list[list[float | None]]
    spearman_matrix: list[list[float | None]]
    top_correlations: list[CorrelationPair]
    notable_negative_correlations: list[CorrelationPair]


# ---------------------------------------------------------------------------
# Machine Learning (Regression)
# ---------------------------------------------------------------------------


class FeatureImportance(BaseModel):
    """Relative importance of an input column in predicting the target."""

    feature: str
    importance: float
    signed_coefficient: float | None = None


class PredictionVsActual(BaseModel):
    """Comparison point for testing model accuracy."""

    actual: float
    predicted: float


class ResidualPoint(BaseModel):
    """Residual error (actual minus predicted) for evaluating model fit."""

    predicted: float
    residual: float


class RegressionModelResult(BaseModel):
    """Performance metrics and diagnostics for one trained regression model."""

    model_name: str
    display_name: str
    is_best_model: bool
    r2_test: float
    mae_test: float
    mse_test: float
    rmse_test: float
    cv_r2_mean: float | None = None
    cv_r2_std: float | None = None
    feature_importances: list[FeatureImportance]
    predictions_vs_actual: list[PredictionVsActual]
    residuals: list[ResidualPoint]


class ModelingResult(BaseModel):
    """Full results of training and comparing machine learning models."""

    target_column: str
    train_samples: int
    test_samples: int
    models: list[RegressionModelResult]
    best_model_name: str
    summary_table: list[dict[str, Any]]
    insight: str
    preparation: dict[str, Any]
    cv_folds: int
    selection_method: str
    failed_models: list[str] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Data Quality
# ---------------------------------------------------------------------------


class MissingValueProfile(BaseModel):
    """Audit of missing (null/NaN) values across the dataset."""

    total_cells: int
    total_missing_cells: int
    overall_missing_percentage: float
    total_rows: int
    complete_rows_count: int
    complete_rows_percentage: float
    rows_with_missing_count: int
    rows_with_missing_percentage: float
    columns_with_missing_count: int
    column_profiles: list[dict[str, Any]]
    recommendation: str


class DuplicateProfile(BaseModel):
    """Audit of duplicate rows."""

    total_rows: int
    duplicate_rows_count: int
    duplicate_rows_percentage: float
    unique_rows_count: int
    status: str  # "clean", "moderate", "severe"
    has_key_column_collisions: bool = False
    key_column_name: str | None = None
    key_collision_count: int = 0
    recommendation: str


class OutlierProfile(BaseModel):
    """Audit of numerical outliers using the IQR (Interquartile Range) method."""

    total_numerical_columns_analyzed: int
    columns_with_outliers_count: int
    total_iqr_outliers: int
    recommendation: str
    profiles: list[dict[str, Any]]


class CardinalityProfile(BaseModel):
    """Audit of constant and high-cardinality categorical columns."""

    constant_columns: list[str]
    quasi_constant_columns: list[str]
    high_cardinality_categorical_columns: list[str]
    recommendation: str


class DataQuality(BaseModel):
    """Consolidated dataset quality metrics."""

    missing: MissingValueProfile
    duplicates: DuplicateProfile
    outliers: OutlierProfile
    cardinality: CardinalityProfile


# ---------------------------------------------------------------------------
# Complete Master Analysis Response
# ---------------------------------------------------------------------------


class AnalysisResponse(BaseModel):
    """Comprehensive payload combining all analytical findings."""

    model_config = ConfigDict(protected_namespaces=())

    dataset_id: str
    dataset_name: str
    health_score: int
    dataset_schema: dict[str, Any] = Field(alias="schema")
    quality: DataQuality
    descriptive_statistics: DescriptiveStatistics
    correlations: CorrelationResult
    hypothesis_tests: list[dict[str, Any]] = Field(default_factory=list)
    problem_detection: dict[str, Any] = Field(default_factory=dict)
    plan: dict[str, Any] = Field(default_factory=dict)
    modeling: ModelingResult | None = None
    clustering: dict[str, Any] | None = None
    pca: dict[str, Any] | None = None
    timeseries: dict[str, Any] | None = None
    insights: list[dict[str, Any]] = Field(default_factory=list)
    insight_discovery: dict[str, Any] = Field(default_factory=dict)
    preview_rows: list[dict[str, Any]] = Field(default_factory=list)
    reports: dict[str, str] = Field(default_factory=dict)


class ExplorationFilter(BaseModel):
    """One bounded filter applied consistently before exploration calculations."""

    column: str = Field(..., min_length=1, max_length=100)
    kind: Literal["category", "number", "date"]
    values: list[str] = Field(default_factory=list, max_length=100)
    minimum: float | None = Field(None, allow_inf_nan=False)
    maximum: float | None = Field(None, allow_inf_nan=False)
    start: str | None = Field(None, max_length=64)
    end: str | None = Field(None, max_length=64)


class ExploreRequest(BaseModel):
    """Interactive, bounded exploration of one cached session-owned dataset."""

    dataset_id: str = Field(..., pattern=r"^[a-zA-Z0-9_\-]{8,64}$")
    mode: Literal["group", "trend", "relationship"]
    metric_column: str | None = Field(None, max_length=100)
    group_column: str | None = Field(None, max_length=100)
    time_column: str | None = Field(None, max_length=100)
    compare_column: str | None = Field(None, max_length=100)
    aggregation: Literal["mean", "median", "count", "sum", "min", "max"] = "mean"
    frequency: Literal["D", "W", "M", "Q", "Y"] = "M"
    filters: list[ExplorationFilter] = Field(default_factory=list, max_length=8)


class ExplorationOptionsRequest(BaseModel):
    dataset_id: str = Field(..., pattern=r"^[a-zA-Z0-9_\-]{8,64}$")
    column: str = Field(..., min_length=1, max_length=100)


class ExplorationOptionsResponse(BaseModel):
    column: str
    kind: Literal["category", "number", "date"]
    values: list[str] = Field(default_factory=list)
    minimum: float | None = None
    maximum: float | None = None
    start: str | None = None
    end: str | None = None
    truncated: bool = False
    observation_count: int | None = None
    span_days: float | None = None
    median_interval_days: float | None = None


class ExplorationPoint(BaseModel):
    x: str | float
    y: float
    detail: str | None = None


class ExplorationChart(BaseModel):
    kind: Literal["line", "bar", "histogram", "scatter"]
    title: str
    x_label: str
    y_label: str
    points: list[ExplorationPoint] = Field(max_length=500)


class ExplorationResponse(BaseModel):
    mode: Literal["group", "trend", "relationship"]
    status: Literal["ready", "empty"]
    dataset_rows: int
    filtered_rows: int
    usable_rows: int = 0
    metric_column: str | None = None
    group_column: str | None = None
    time_column: str | None = None
    compare_column: str | None = None
    aggregation: str
    frequency: str | None = None
    filters: list[dict[str, Any]]
    chart: ExplorationChart | None = None
    groups: list[dict[str, Any]] = Field(default_factory=list, max_length=50)
    periods: list[dict[str, Any]] = Field(default_factory=list, max_length=500)
    first_period: dict[str, Any] | None = None
    last_period: dict[str, Any] | None = None
    absolute_change: float | None = None
    percentage_change: float | None = None
    period_over_period_change: float | None = None
    highest_period: dict[str, Any] | None = None
    lowest_period: dict[str, Any] | None = None
    variability: float | None = None
    missing_periods: int = 0
    unusual_changes: list[dict[str, Any]] = Field(default_factory=list, max_length=20)
    pearson_r: float | None = None
    spearman_rho: float | None = None
    valid_pairs: int = 0
    interpretation: str
    limitations: list[str]
