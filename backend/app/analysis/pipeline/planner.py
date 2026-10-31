"""Analysis planner determining admissible algorithms and tracking skipped analyses."""

from dataclasses import dataclass

from app.analysis.pipeline.detector import ProblemDetectionResult
from app.analysis.profiler.schema import SchemaProfile


@dataclass
class SkippedAnalysis:
    """Rationale for bypassing an algorithm or routine."""

    name: str
    category: str
    reason: str


@dataclass
class PlannedAnalysis:
    """An approved analysis routine to execute."""

    name: str
    category: str  # "regression", "classification", "clustering", "dimensionality", "timeseries"
    description: str


@dataclass
class ExecutionPlan:
    """Comprehensive analysis execution plan."""

    problem_type: str
    target_column: str | None
    planned_analyses: list[PlannedAnalysis]
    skipped_analyses: list[SkippedAnalysis]
    feature_columns: list[str]
    can_run_ml: bool
    summary: str


def plan_analyses(
    schema: SchemaProfile,
    problem: ProblemDetectionResult,
) -> ExecutionPlan:
    """Formulates a principled analysis plan based on dataset profile and objective."""
    planned: list[PlannedAnalysis] = []
    skipped: list[SkippedAnalysis] = []

    row_count = schema.row_count
    num_cols = [
        c
        for c in schema.numerical_columns
        if c not in schema.id_columns and c not in schema.constant_columns
    ]
    [
        c
        for c in schema.categorical_columns
        if c not in schema.id_columns and c not in schema.constant_columns
    ]

    target = problem.target_column
    feature_cols = [
        c.name
        for c in schema.columns
        if c.name != target
        and not c.is_id_candidate
        and not c.is_constant
        and c.inferred_type not in ["text", "datetime"]
    ]

    # Data volume check
    if row_count < 15:
        skipped.append(
            SkippedAnalysis(
                name="Supervised Machine Learning",
                category="ml",
                reason=f"Insufficient sample size ({row_count} rows). Machine learning requires at least 15 observations to prevent severe overfitting.",
            )
        )
        return ExecutionPlan(
            problem_type=problem.problem_type,
            target_column=target,
            planned_analyses=planned,
            skipped_analyses=skipped,
            feature_columns=feature_cols,
            can_run_ml=False,
            summary="Dataset size insufficient for predictive modeling. Restricted to descriptive analytics.",
        )

    # Supervised Regression Plan
    if problem.problem_type == "regression":
        if not target or target not in schema.numerical_columns:
            skipped.append(
                SkippedAnalysis(
                    name="Regression Suite",
                    category="regression",
                    reason=f"Target '{target}' is not a continuous numerical variable.",
                )
            )
        elif len(feature_cols) == 0:
            skipped.append(
                SkippedAnalysis(
                    name="Regression Suite",
                    category="regression",
                    reason="No valid feature columns available after excluding ID, constant, and target columns.",
                )
            )
        else:
            planned.extend(
                [
                    PlannedAnalysis(
                        name="DummyRegressor",
                        category="regression",
                        description="Empirical mean/median baseline model",
                    ),
                    PlannedAnalysis(
                        name="LinearRegression",
                        category="regression",
                        description="Ordinary least squares with standard scaling",
                    ),
                    PlannedAnalysis(
                        name="Ridge",
                        category="regression",
                        description="L2 regularized linear regression",
                    ),
                    PlannedAnalysis(
                        name="Lasso",
                        category="regression",
                        description="L1 regularized sparse linear regression",
                    ),
                    PlannedAnalysis(
                        name="ElasticNet",
                        category="regression",
                        description="Combined L1 and L2 regularized regression",
                    ),
                    PlannedAnalysis(
                        name="RandomForestRegressor",
                        category="regression",
                        description="Ensemble bagging with 50 decision trees",
                    ),
                    PlannedAnalysis(
                        name="GradientBoostingRegressor",
                        category="regression",
                        description="Gradient boosted decision trees",
                    ),
                ]
            )
            skipped.append(
                SkippedAnalysis(
                    name="Classification Suite",
                    category="classification",
                    reason="Problem type is regression with continuous target; classification is inadmissible.",
                )
            )

    # Supervised Classification Plan
    elif problem.problem_type in ["binary_classification", "multiclass_classification"]:
        if len(feature_cols) == 0:
            skipped.append(
                SkippedAnalysis(
                    name="Classification Suite",
                    category="classification",
                    reason="No valid feature columns available after excluding ID, constant, and target columns.",
                )
            )
        else:
            planned.extend(
                [
                    PlannedAnalysis(
                        name="DummyClassifier",
                        category="classification",
                        description="Most frequent class baseline",
                    ),
                    PlannedAnalysis(
                        name="LogisticRegression",
                        category="classification",
                        description="Regularized multinomial/binomial logistic regression",
                    ),
                    PlannedAnalysis(
                        name="RandomForestClassifier",
                        category="classification",
                        description="Ensemble random forest with 50 trees",
                    ),
                    PlannedAnalysis(
                        name="GradientBoostingClassifier",
                        category="classification",
                        description="Gradient boosted classification trees",
                    ),
                ]
            )
            skipped.append(
                SkippedAnalysis(
                    name="Regression Suite",
                    category="regression",
                    reason=f"Target '{target}' is categorical with discrete classes; continuous regression is inadmissible.",
                )
            )

    # Dimensionality Reduction Plan (PCA)
    avail_num_features = [c for c in num_cols if c != target]
    if len(avail_num_features) >= 2:
        planned.append(
            PlannedAnalysis(
                name="PrincipalComponentAnalysis",
                category="dimensionality",
                description="2D orthogonal variance projection with feature loadings",
            )
        )
    else:
        skipped.append(
            SkippedAnalysis(
                name="Principal Component Analysis (PCA)",
                category="dimensionality",
                reason=f"Requires at least 2 numerical features; found {len(avail_num_features)}.",
            )
        )

    # Clustering Plan
    if len(avail_num_features) >= 2 and row_count >= 20:
        planned.extend(
            [
                PlannedAnalysis(
                    name="KMeans",
                    category="clustering",
                    description="Partitioning clustering with optimal silhouette score selection",
                ),
                PlannedAnalysis(
                    name="DBSCAN",
                    category="clustering",
                    description="Density-based spatial clustering with noise detection",
                ),
            ]
        )
    else:
        skipped.append(
            SkippedAnalysis(
                name="Clustering Suite",
                category="clustering",
                reason=f"Requires at least 2 numerical features and >= 20 rows; found {len(avail_num_features)} features and {row_count} rows.",
            )
        )

    # Time series plan
    if problem.problem_type == "time_series":
        planned.append(
            PlannedAnalysis(
                name="TimeSeriesAnalysis",
                category="timeseries",
                description="Stationarity ADF test, lag autocorrelation, and temporal trends",
            )
        )
    else:
        skipped.append(
            SkippedAnalysis(
                name="Time Series Decomposition",
                category="timeseries",
                reason="No regular datetime index or chronological ordering identified.",
            )
        )

    can_run_ml = any(p.category in ["regression", "classification", "clustering"] for p in planned)

    return ExecutionPlan(
        problem_type=problem.problem_type,
        target_column=target,
        planned_analyses=planned,
        skipped_analyses=skipped,
        feature_columns=feature_cols,
        can_run_ml=can_run_ml,
        summary=f"Plan generated: {len(planned)} algorithms approved, {len(skipped)} skipped with statistical rationale.",
    )
