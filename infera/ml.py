"""Machine Learning module for Infera.

Trains a clean, transparent scikit-learn Linear Regression model with:
1. Strict 80/20 train/test split.
2. Missing-value imputation fitted only on training data (preventing data leakage).
3. Standard regression evaluation metrics (R², MAE, RMSE).
4. Feature coefficients and sample test predictions for charting.
"""

from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split

MIN_ROWS_FOR_TRAINING = 10


def train_linear_regression(
    df: pd.DataFrame,
    target_column: str,
    feature_columns: list[str] | None = None,
) -> dict[str, Any]:
    """Train a Linear Regression model on the specified target column."""
    if target_column not in df.columns:
        raise ValueError(f"Target column '{target_column}' does not exist in the dataset.")

    if not pd.api.types.is_numeric_dtype(df[target_column]):
        raise ValueError(
            f"Target column '{target_column}' is not numeric. Linear Regression requires a continuous numeric target."
        )

    # Automatically select remaining numeric columns if feature columns are not provided
    if feature_columns is None:
        feature_columns = [
            col
            for col in df.columns
            if col != target_column and pd.api.types.is_numeric_dtype(df[col])
        ]
    else:
        # Validate requested feature columns
        for col in feature_columns:
            if col not in df.columns:
                raise ValueError(f"Feature column '{col}' does not exist in dataset.")
            if not pd.api.types.is_numeric_dtype(df[col]):
                raise ValueError(f"Feature column '{col}' is not numeric.")

    if not feature_columns:
        raise ValueError("No valid numeric feature columns available to train the model.")

    # Drop rows where target is missing
    valid_df = df.dropna(subset=[target_column])
    if len(valid_df) < MIN_ROWS_FOR_TRAINING:
        raise ValueError(
            f"Dataset has only {len(valid_df)} rows with non-null target values. "
            f"At least {MIN_ROWS_FOR_TRAINING} rows are required to train."
        )

    X = valid_df[feature_columns]
    y = valid_df[target_column].astype(float)

    # 80% train, 20% test split
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    if len(X_train) == 0 or len(X_test) == 0:
        raise ValueError("Insufficient data to form non-empty train and test splits.")

    # Impute missing feature values (fit ONLY on training set to avoid data leakage)
    imputer = SimpleImputer(strategy="mean")
    X_train_imputed = imputer.fit_transform(X_train)
    X_test_imputed = imputer.transform(X_test)

    # Train Ordinary Least Squares Linear Regression
    model = LinearRegression()
    model.fit(X_train_imputed, y_train)

    # Predict
    y_train_pred = model.predict(X_train_imputed)
    y_test_pred = model.predict(X_test_imputed)

    # Metrics
    train_r2 = float(r2_score(y_train, y_train_pred))
    test_r2 = float(r2_score(y_test, y_test_pred))
    mae = float(mean_absolute_error(y_test, y_test_pred))
    mse = float(mean_squared_error(y_test, y_test_pred))
    rmse = float(np.sqrt(mse))

    # Feature coefficients
    coefficients: list[dict[str, Any]] = []
    for col, weight in zip(feature_columns, model.coef_):
        coefficients.append(
            {
                "feature": col,
                "weight": round(float(weight), 4),
                "abs_weight": round(abs(float(weight)), 4),
            }
        )
    coefficients.sort(key=lambda item: item["abs_weight"], reverse=True)

    # Sample actual vs predicted points (up to 50 test samples for charting)
    chart_points: list[dict[str, float]] = []
    for act, pred in zip(y_test.iloc[:50], y_test_pred[:50]):
        chart_points.append(
            {
                "actual": round(float(act), 4),
                "predicted": round(float(pred), 4),
            }
        )

    return {
        "target_column": target_column,
        "feature_columns": feature_columns,
        "train_samples": int(len(X_train)),
        "test_samples": int(len(X_test)),
        "metrics": {
            "r2": round(test_r2, 4),
            "train_r2": round(train_r2, 4),
            "mae": round(mae, 4),
            "rmse": round(rmse, 4),
            "mse": round(mse, 4),
        },
        "coefficients": [{"feature": c["feature"], "weight": c["weight"]} for c in coefficients],
        "intercept": round(float(model.intercept_), 4),
        "chart_points": chart_points,
    }
