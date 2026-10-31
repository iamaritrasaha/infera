"""Predictive modeling using machine learning (regression).

This module trains and compares multiple regression models using scikit-learn
to predict a continuous target variable from dataset features.

Mathematical and Machine Learning Concepts:
- Train/Test Split (80/20): Evaluates the model on unseen data to test generalization.
- R² Score (Coefficient of Determination): The fraction of variance explained (1.0 is perfect, 0.0 is baseline).
- MAE (Mean Absolute Error): Average absolute difference between actual and predicted values.
- RMSE (Root Mean Squared Error): Square root of average squared errors, penalizing large mistakes.
- Residuals: (Actual - Predicted) errors used to inspect prediction bias.
"""

from typing import Any

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import LinearRegression, Ridge
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import KFold, cross_val_score, train_test_split

from infera.models import (
    FeatureImportance,
    ModelingResult,
    PredictionVsActual,
    RegressionModelResult,
    ResidualPoint,
)

# Minimum rows required to safely split data into training and test sets
MIN_ROWS_FOR_REGRESSION = 10

# Maximum sample points to return for scatter plots to keep browser fast
MAX_PLOT_POINTS = 50


def prepare_regression_data(
    df: pd.DataFrame,
    target_column: str,
    feature_columns: list[str] | None = None,
) -> tuple[pd.DataFrame, pd.Series, list[str]]:
    """Clean and prepare feature matrix X and target vector y for modeling.

    Steps:
    1. Validate target column exists and is numerical.
    2. Select candidate numerical feature columns (excluding target and ID columns).
    3. Drop rows where target is missing (NaN).
    4. Fill missing values in features using column means (imputation).
    """
    if target_column not in df.columns:
        raise ValueError(f"Target column '{target_column}' does not exist in dataset.")

    if not pd.api.types.is_numeric_dtype(df[target_column]):
        raise ValueError(
            f"Target column '{target_column}' is not numerical. Regression requires a continuous numeric target."
        )

    # Drop rows where target is NaN
    clean_df = df.dropna(subset=[target_column]).copy()
    if len(clean_df) < MIN_ROWS_FOR_REGRESSION:
        raise ValueError(
            f"Dataset has only {len(clean_df)} complete rows for '{target_column}'. "
            f"At least {MIN_ROWS_FOR_REGRESSION} rows are required for regression."
        )

    # Determine feature columns if not explicitly provided
    if feature_columns is None:
        feature_columns = [
            c
            for c in clean_df.columns
            if c != target_column
            and pd.api.types.is_numeric_dtype(clean_df[c])
            and c.lower() not in ["id", "index", "row_id", "uuid"]
            and clean_df[c].nunique() > 1
        ]

    if len(feature_columns) == 0:
        raise ValueError("No valid numerical feature columns available for regression.")

    X = clean_df[feature_columns].copy()
    y = clean_df[target_column].astype(float)

    # Impute missing feature values with the column mean
    for col in feature_columns:
        if X[col].isna().any():
            X[col] = X[col].fillna(X[col].mean())

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
    """Train a single scikit-learn regression model and compute all performance metrics."""
    # 1. Fit model on training data
    model.fit(X_train, y_train)

    # 2. Predict on test data
    y_pred = model.predict(X_test)

    # 3. Compute accuracy metrics
    r2 = float(r2_score(y_test, y_pred))
    mae = float(mean_absolute_error(y_test, y_pred))
    mse = float(mean_squared_error(y_test, y_pred))
    rmse = float(np.sqrt(mse))

    # 4. Compute 5-fold cross validation score on training set
    cv_mean: float | None = None
    cv_std: float | None = None
    if len(X_train) >= 10:
        try:
            cv = KFold(n_splits=min(5, len(X_train)), shuffle=True, random_state=42)
            cv_scores = cross_val_score(model, X_train, y_train, cv=cv, scoring="r2")
            cv_mean = float(np.mean(cv_scores))
            cv_std = float(np.std(cv_scores))
        except Exception:
            cv_mean, cv_std = None, None

    # 5. Extract feature importances
    feature_importances: list[FeatureImportance] = []
    if hasattr(model, "coef_"):
        # For linear models, coefficients indicate feature weight
        coefs = np.array(model.coef_).flatten()
        abs_sum = float(np.sum(np.abs(coefs)))
        for feat, coef in zip(feature_names, coefs):
            normalized_imp = float(abs(coef) / abs_sum) if abs_sum > 0 else 0.0
            feature_importances.append(
                FeatureImportance(
                    feature=feat,
                    importance=round(normalized_imp, 4),
                    signed_coefficient=round(float(coef), 4),
                )
            )
    elif hasattr(model, "feature_importances_"):
        # For tree-based models, feature_importances_ measures reduction in variance
        importances = model.feature_importances_
        for feat, imp in zip(feature_names, importances):
            feature_importances.append(
                FeatureImportance(
                    feature=feat,
                    importance=round(float(imp), 4),
                    signed_coefficient=None,
                )
            )

    # Sort feature importances descending
    feature_importances.sort(key=lambda fi: fi.importance, reverse=True)

    # 6. Prepare predictions vs actual and residuals sample points
    predictions_vs_actual: list[PredictionVsActual] = []
    residuals: list[ResidualPoint] = []

    y_test_arr = np.array(y_test)
    y_pred_arr = np.array(y_pred)
    sample_indices = np.linspace(
        0, len(y_test_arr) - 1, min(len(y_test_arr), MAX_PLOT_POINTS), dtype=int
    )

    for idx in sample_indices:
        act = float(y_test_arr[idx])
        pred = float(y_pred_arr[idx])
        res = act - pred
        predictions_vs_actual.append(
            PredictionVsActual(actual=round(act, 3), predicted=round(pred, 3))
        )
        residuals.append(
            ResidualPoint(predicted=round(pred, 3), residual=round(res, 3))
        )

    return RegressionModelResult(
        model_name=model_name,
        display_name=display_name,
        is_best_model=False,  # Updated after comparison
        r2_test=round(r2, 4),
        mae_test=round(mae, 4),
        mse_test=round(mse, 4),
        rmse_test=round(rmse, 4),
        cv_r2_mean=round(cv_mean, 4) if cv_mean is not None else None,
        cv_r2_std=round(cv_std, 4) if cv_std is not None else None,
        feature_importances=feature_importances,
        predictions_vs_actual=predictions_vs_actual,
        residuals=residuals,
    )


def train_regression_models(
    df: pd.DataFrame,
    target_column: str,
    feature_columns: list[str] | None = None,
) -> ModelingResult:
    """Train multiple regression algorithms, compare their R² scores, and pick the best performer.

    Models trained:
    1. Linear Regression: Interpretable baseline fitting a straight hyperplane.
    2. Ridge Regression: Linear regression with L2 regularization to prevent overfitting.
    3. Random Forest: Ensemble of decision trees capturing non-linear relationships.
    """
    X, y, selected_features = prepare_regression_data(
        df, target_column, feature_columns
    )

    # Train/test split: 80% training, 20% testing
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )

    # List of models to benchmark
    candidate_models = [
        ("linear_regression", "Linear Regression", LinearRegression()),
        ("ridge_regression", "Ridge Regression", Ridge(alpha=1.0)),
        (
            "random_forest",
            "Random Forest Regressor",
            RandomForestRegressor(n_estimators=50, random_state=42),
        ),
    ]

    results: list[RegressionModelResult] = []
    failed_models: list[str] = []

    for key, display, model in candidate_models:
        try:
            res = train_and_evaluate_single_model(
                model=model,
                model_name=key,
                display_name=display,
                X_train=X_train,
                X_test=X_test,
                y_train=y_train,
                y_test=y_test,
                feature_names=selected_features,
            )
            results.append(res)
        except Exception as err:
            failed_models.append(f"{display}: {err}")

    if not results:
        raise ValueError(f"All regression models failed to fit: {failed_models}")

    # Identify champion model by highest R² on test set
    best_result = max(results, key=lambda r: r.r2_test)
    best_result.is_best_model = True

    # Build comparison summary table
    summary_table = []
    for r in results:
        summary_table.append(
            {
                "model": r.display_name,
                "r2_test": r.r2_test,
                "rmse": r.rmse_test,
                "mae": r.mae_test,
                "is_best": r.is_best_model,
            }
        )

    # Plain English insight explaining the results
    variance_pct = max(0.0, best_result.r2_test * 100.0)
    top_feature = (
        best_result.feature_importances[0].feature
        if best_result.feature_importances
        else "None"
    )
    insight = (
        f"{best_result.display_name} performed best with an R² score of {best_result.r2_test:.2f}, "
        f"explaining approximately {variance_pct:.1f}% of the variance in '{target_column}'. "
        f"The most influential predictor is '{top_feature}'."
    )

    preparation_info: dict[str, Any] = {
        "features_used": selected_features,
        "train_rows": len(X_train),
        "test_rows": len(X_test),
        "imputation": "mean",
    }

    return ModelingResult(
        target_column=target_column,
        train_samples=len(X_train),
        test_samples=len(X_test),
        models=results,
        best_model_name=best_result.display_name,
        summary_table=summary_table,
        insight=insight,
        preparation=preparation_info,
        cv_folds=5,
        selection_method="Highest R² on 20% holdout test set",
        failed_models=failed_models,
    )
