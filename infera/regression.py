"""Readable numeric regression benchmarks with train-only preprocessing.

Random holdouts assume independent observations. They are not time forecasts.
Categorical predictors must be encoded explicitly before use.
"""

from typing import Any

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LinearRegression, Ridge
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import KFold, cross_val_score, train_test_split
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

from infera.models import (
    FeatureImportance,
    ModelingResult,
    PredictionVsActual,
    RegressionModelResult,
    ResidualPoint,
)

MIN_ROWS_FOR_REGRESSION = 10
MAX_PLOT_POINTS = 50


def prepare_regression_data(
    df: pd.DataFrame, target_column: str, feature_columns: list[str] | None = None
) -> tuple[pd.DataFrame, pd.Series, list[str]]:
    """Validate numeric inputs; leave missing predictors for the training pipeline."""
    if target_column not in df:
        raise ValueError(f"Target column '{target_column}' does not exist.")
    if not pd.api.types.is_numeric_dtype(df[target_column]):
        raise ValueError("Target is not numerical. Regression requires a numeric target.")
    clean = df.dropna(subset=[target_column])
    if len(clean) < MIN_ROWS_FOR_REGRESSION:
        raise ValueError("At least 10 rows with observed targets are required for regression.")
    if feature_columns is None:
        feature_columns = [
            c
            for c in clean
            if c != target_column
            and pd.api.types.is_numeric_dtype(clean[c])
            and c.lower() not in {"id", "index", "row_id", "uuid"}
            and clean[c].nunique() > 1
        ]
    if not feature_columns:
        raise ValueError("No valid numerical feature columns available for regression.")
    if any(c not in clean for c in feature_columns):
        raise ValueError("A selected feature does not exist.")
    if target_column in feature_columns:
        raise ValueError("Target cannot also be a predictor (data leakage).")
    if len(set(feature_columns)) != len(feature_columns):
        raise ValueError("Feature columns must be unique.")
    if any(not pd.api.types.is_numeric_dtype(clean[c]) for c in feature_columns):
        raise ValueError(
            "Only numerical predictors are supported; encode categorical columns explicitly."
        )
    # Identical observations must not occur on both sides of the holdout.
    clean = clean.drop_duplicates(subset=[*feature_columns, target_column])
    if len(clean) < MIN_ROWS_FOR_REGRESSION:
        raise ValueError("At least 10 distinct observations are required for regression.")
    X, y = clean[feature_columns].astype(float).copy(), clean[target_column].astype(float)
    if np.isinf(X.to_numpy()).any() or not np.isfinite(y).all():
        raise ValueError("Regression requires finite numeric values.")
    if y.nunique() < 2:
        raise ValueError("Target must have at least two distinct values.")
    return X, y, feature_columns


def train_and_evaluate_single_model(
    model: Any,
    model_name: str,
    display_name: str,
    X_train: pd.DataFrame,
    X_test: pd.DataFrame,
    y_train: pd.Series,
    y_test: pd.Series,
    feature_names: list[str],
) -> RegressionModelResult:
    """Fit preprocessing inside every fold; measure errors on the untouched holdout."""
    pipeline = make_pipeline(
        SimpleImputer(strategy="mean", keep_empty_features=True), StandardScaler(), model
    )
    pipeline.fit(X_train, y_train)
    predicted = pipeline.predict(X_test)
    r2 = float(r2_score(y_test, predicted))
    mae = float(mean_absolute_error(y_test, predicted))
    mse = float(mean_squared_error(y_test, predicted))
    if not np.isfinite([r2, mae, mse]).all():
        raise ValueError("Model produced non-finite metrics.")
    cv_mean, cv_std = None, None
    if len(X_train) >= 10:
        scores = cross_val_score(
            pipeline,
            X_train,
            y_train,
            cv=KFold(5, shuffle=True, random_state=42),
            scoring="r2",
            error_score="raise",
        )
        if np.isfinite(scores).all():
            cv_mean, cv_std = float(scores.mean()), float(scores.std())
    importances = []
    if hasattr(model, "coef_"):
        coefficients = np.asarray(model.coef_).flatten()
        total = float(np.abs(coefficients).sum())
        importances = [
            FeatureImportance(
                feature=name,
                importance=round(float(abs(coef) / total), 4) if total else 0.0,
                signed_coefficient=round(float(coef), 4),
            )
            for name, coef in zip(feature_names, coefficients)
        ]
    elif hasattr(model, "feature_importances_"):
        importances = [
            FeatureImportance(feature=name, importance=round(float(value), 4))
            for name, value in zip(feature_names, model.feature_importances_)
        ]
    importances.sort(key=lambda item: item.importance, reverse=True)
    indices = np.linspace(0, len(y_test) - 1, min(len(y_test), MAX_PLOT_POINTS), dtype=int)
    actual = y_test.to_numpy()
    return RegressionModelResult(
        model_name=model_name,
        display_name=display_name,
        is_best_model=False,
        r2_test=round(r2, 4),
        mae_test=round(mae, 4),
        mse_test=round(mse, 4),
        rmse_test=round(float(np.sqrt(mse)), 4),
        cv_r2_mean=round(cv_mean, 4) if cv_mean is not None else None,
        cv_r2_std=round(cv_std, 4) if cv_std is not None else None,
        feature_importances=importances,
        predictions_vs_actual=[
            PredictionVsActual(actual=float(actual[i]), predicted=float(predicted[i]))
            for i in indices
        ],
        residuals=[
            ResidualPoint(predicted=float(predicted[i]), residual=float(actual[i] - predicted[i]))
            for i in indices
        ],
    )


def train_regression_models(
    df: pd.DataFrame, target_column: str, feature_columns: list[str] | None = None
) -> ModelingResult:
    """Compare three regressors using training CV, keeping the test set out of selection."""
    X, y, features = prepare_regression_data(df, target_column, feature_columns)
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    if y_train.nunique() < 2 or y_test.nunique() < 2:
        raise ValueError("Training and holdout targets must both vary to evaluate R-squared.")
    candidates = [
        ("linear_regression", "Linear Regression", LinearRegression()),
        ("ridge_regression", "Ridge Regression", Ridge(alpha=1.0)),
        (
            "random_forest",
            "Random Forest Regressor",
            RandomForestRegressor(n_estimators=50, random_state=42),
        ),
    ]
    results, failures = [], []
    for key, display, model in candidates:
        try:
            results.append(
                train_and_evaluate_single_model(
                    model, key, display, X_train, X_test, y_train, y_test, features
                )
            )
        except (ValueError, FloatingPointError) as err:
            failures.append(f"{display}: {err}")
    if not results:
        raise ValueError(f"All regression models failed: {failures}")
    best = max(results, key=lambda r: r.cv_r2_mean if r.cv_r2_mean is not None else -float("inf"))
    best.is_best_model = True
    folds = 5 if len(X_train) >= 10 else 0
    return ModelingResult(
        target_column=target_column,
        train_samples=len(X_train),
        test_samples=len(X_test),
        models=results,
        best_model_name=best.display_name,
        summary_table=[
            {
                "model": r.display_name,
                "r2_test": r.r2_test,
                "rmse": r.rmse_test,
                "mae": r.mae_test,
                "is_best": r.is_best_model,
            }
            for r in results
        ],
        insight=f"{best.display_name} was selected using training cross-validation (fixed candidate order when unavailable). Its holdout R-squared is {best.r2_test:.4f}. Negative R-squared means worse than predicting the test mean. Importance is model-specific association, not causation.",
        preparation={
            "features_used": features,
            "train_rows": len(X_train),
            "test_rows": len(X_test),
            "imputation": "mean fitted on training folds only",
            "categorical_predictors": "excluded; numeric predictors only",
            "coefficient_units": "per training standard deviation",
        },
        cv_folds=folds,
        selection_method="Highest training CV R-squared; fixed candidate order fallback without CV. Random holdout assumes independent rows, not time forecasting.",
        failed_models=failures,
    )
