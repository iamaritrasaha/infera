"""Automatic problem formulation and target detection."""

from dataclasses import dataclass

import pandas as pd

from app.analysis.profiler.schema import SchemaProfile


@dataclass
class ProblemDetectionResult:
    """Outcome of automatic problem detection."""

    problem_type: str  # "regression", "binary_classification", "multiclass_classification", "clustering", "time_series", "exploratory"
    target_column: str | None
    confidence: str  # "high", "moderate", "heuristic"
    reason: str
    target_details: dict[str, str | int | float | None]
    alternative_targets: list[dict[str, str]]


def detect_problem_type(
    df: pd.DataFrame,
    schema: SchemaProfile,
    user_target: str | None = None,
) -> ProblemDetectionResult:
    """Determines the most appropriate statistical or machine learning objective."""
    row_count = len(df)
    alt_targets = [t for t in schema.potential_targets]

    # If user explicitly specified target
    if user_target and user_target in df.columns:
        series = df[user_target].dropna()
        n_unique = series.nunique()
        is_num = user_target in schema.numerical_columns

        if is_num and n_unique > 10:
            return ProblemDetectionResult(
                problem_type="regression",
                target_column=user_target,
                confidence="high",
                reason=f"User-selected target '{user_target}' is continuous numerical with {n_unique} unique observations.",
                target_details={
                    "name": user_target,
                    "unique_count": n_unique,
                    "dtype": str(series.dtype),
                },
                alternative_targets=[t for t in alt_targets if t["column"] != user_target],
            )
        elif n_unique == 2:
            classes = [str(x) for x in series.unique()]
            return ProblemDetectionResult(
                problem_type="binary_classification",
                target_column=user_target,
                confidence="high",
                reason=f"User-selected target '{user_target}' contains exactly two distinct classes: {classes}.",
                target_details={
                    "name": user_target,
                    "unique_count": 2,
                    "classes": ", ".join(classes),
                },
                alternative_targets=[t for t in alt_targets if t["column"] != user_target],
            )
        elif 3 <= n_unique <= 20:
            classes = [str(x) for x in series.unique()[:5]]
            return ProblemDetectionResult(
                problem_type="multiclass_classification",
                target_column=user_target,
                confidence="high",
                reason=f"User-selected target '{user_target}' contains {n_unique} discrete categories ({', '.join(classes)}...).",
                target_details={"name": user_target, "unique_count": n_unique},
                alternative_targets=[t for t in alt_targets if t["column"] != user_target],
            )
        else:
            return ProblemDetectionResult(
                problem_type="exploratory",
                target_column=user_target,
                confidence="moderate",
                reason=f"Target '{user_target}' has {n_unique} unique values which may not suit standard supervised models.",
                target_details={"name": user_target, "unique_count": n_unique},
                alternative_targets=alt_targets,
            )

    # Automatic Target Inference:
    # Check for conventional target column names first
    candidate_names = [
        "target",
        "label",
        "outcome",
        "churn",
        "churned",
        "status",
        "price",
        "sales",
        "revenue",
        "profit",
        "score",
        "default",
        "attrition",
        "class",
        "response",
    ]

    selected_col: str | None = None
    selected_reason: str = ""
    selected_type: str = "exploratory"

    # Search known candidate naming conventions
    lower_cols = {c.lower(): c for c in df.columns}
    for cand in candidate_names:
        if cand in lower_cols:
            real_col = lower_cols[cand]
            if real_col not in schema.id_columns and real_col not in schema.constant_columns:
                series = df[real_col].dropna()
                nunique = series.nunique()
                if real_col in schema.numerical_columns and nunique > 10:
                    selected_col = real_col
                    selected_type = "regression"
                    selected_reason = f"Column '{real_col}' is numerical with {nunique} unique values and represents a continuous outcome."
                    break
                elif nunique == 2:
                    selected_col = real_col
                    selected_type = "binary_classification"
                    selected_reason = f"Column '{real_col}' contains exactly two distinct classes representing a binary outcome."
                    break
                elif 3 <= nunique <= 15:
                    selected_col = real_col
                    selected_type = "multiclass_classification"
                    selected_reason = f"Column '{real_col}' has {nunique} categorical outcomes suitable for multi-class prediction."
                    break

    # If still not found, check if last column is a candidate (common tabular dataset convention)
    if not selected_col and len(df.columns) >= 2:
        last_col = df.columns[-1]
        if last_col not in schema.id_columns and last_col not in schema.constant_columns:
            series = df[last_col].dropna()
            nunique = series.nunique()
            if last_col in schema.numerical_columns and nunique > 10:
                selected_col = last_col
                selected_type = "regression"
                selected_reason = f"Last column '{last_col}' is continuous numerical ({nunique} unique values), indicating a primary response variable."
            elif nunique == 2:
                selected_col = last_col
                selected_type = "binary_classification"
                selected_reason = f"Last column '{last_col}' is a binary attribute ({nunique} distinct states), indicating a classification label."
            elif 3 <= nunique <= 10:
                selected_col = last_col
                selected_type = "multiclass_classification"
                selected_reason = f"Last column '{last_col}' has {nunique} distinct categories, indicating a multi-class outcome."

    # Check for Time Series structure
    if schema.datetime_columns and len(schema.numerical_columns) >= 1:
        dt_col = schema.datetime_columns[0]
        # Check if rows appear chronologically ordered or monotonic
        try:
            parsed_dates = pd.to_datetime(df[dt_col].dropna().head(20), errors="coerce")
            if parsed_dates.is_monotonic_increasing and not selected_col:
                num_target = schema.numerical_columns[0]
                return ProblemDetectionResult(
                    problem_type="time_series",
                    target_column=num_target,
                    confidence="moderate",
                    reason=f"Dataset contains chronological datetime column '{dt_col}' alongside metric '{num_target}'.",
                    target_details={"datetime_column": dt_col, "metric": num_target},
                    alternative_targets=alt_targets,
                )
        except Exception:
            pass

    # If a supervised target was identified
    if selected_col:
        return ProblemDetectionResult(
            problem_type=selected_type,
            target_column=selected_col,
            confidence="high",
            reason=selected_reason,
            target_details={"name": selected_col, "unique_count": int(df[selected_col].nunique())},
            alternative_targets=[t for t in alt_targets if t["column"] != selected_col],
        )

    # If no target found, but we have multiple numerical features -> Clustering
    if len(schema.numerical_columns) >= 2 and row_count >= 15:
        return ProblemDetectionResult(
            problem_type="clustering",
            target_column=None,
            confidence="moderate",
            reason=(
                f"No explicit target attribute detected. Dataset has {len(schema.numerical_columns)} numerical features "
                "suitable for unsupervised segmentation and structure discovery."
            ),
            target_details={},
            alternative_targets=alt_targets,
        )

    # Default to Exploratory
    return ProblemDetectionResult(
        problem_type="exploratory",
        target_column=None,
        confidence="moderate",
        reason="Dataset is best suited for descriptive profiling, distribution analysis, and correlation exploration.",
        target_details={},
        alternative_targets=alt_targets,
    )
