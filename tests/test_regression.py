"""Tests for infera.regression.

These tests use synthetic linear data to demonstrate:
1. Model training and evaluation (R², MAE, RMSE).
2. Data preparation, missing value imputation, and validation.
3. Feature importance extraction.
4. Error handling for invalid inputs.
"""

import numpy as np
import pandas as pd
import pytest

from infera.regression import (
    prepare_regression_data,
    train_regression_models,
)


def test_linear_regression_on_synthetic_data():
    """Verify that regression accurately fits a known linear function: y = 2*x + 10.

    On clean linear data, R² should be nearly 1.0, and MAE should be close to 0.
    """
    np.random.seed(42)
    x = np.linspace(1, 50, 30)
    y = 2.0 * x + 10.0  # Perfect line with no noise
    df = pd.DataFrame({"feature_x": x, "target_y": y})

    result = train_regression_models(df, target_column="target_y")

    assert result.target_column == "target_y"
    assert result.train_samples > 0
    assert result.test_samples > 0
    assert len(result.models) >= 2

    # Linear Regression should achieve near perfect R² on linear data
    lin_model = next(m for m in result.models if m.model_name == "linear_regression")
    assert lin_model.r2_test > 0.99
    assert lin_model.mae_test < 0.1

    # Feature importance should rank feature_x highest
    assert lin_model.feature_importances[0].feature == "feature_x"


def test_regression_imputes_missing_feature_values():
    """Missing values in predictor columns should be imputed rather than crashing."""
    df = pd.DataFrame(
        {
            "sqft": [
                1000.0,
                None,
                1500.0,
                1800.0,
                2000.0,
                None,
                2500.0,
                2800.0,
                3000.0,
                3200.0,
                3500.0,
                4000.0,
            ],
            "bedrooms": [2, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5],
            "price": [
                200.0,
                250.0,
                300.0,
                360.0,
                400.0,
                420.0,
                500.0,
                560.0,
                600.0,
                640.0,
                700.0,
                800.0,
            ],
        }
    )

    result = train_regression_models(df, target_column="price")
    assert result.best_model_name != ""
    assert result.models[0].r2_test > 0.5


def test_regression_rejects_missing_target():
    """Attempting regression with a non-existent target column raises ValueError."""
    df = pd.DataFrame({"a": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]})
    with pytest.raises(ValueError, match="does not exist"):
        prepare_regression_data(df, target_column="non_existent")


def test_regression_rejects_non_numeric_target():
    """Attempting regression with a string/categorical target raises ValueError."""
    df = pd.DataFrame(
        {
            "feature": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
            "target": [
                "red",
                "blue",
                "red",
                "blue",
                "red",
                "blue",
                "red",
                "blue",
                "red",
                "blue",
                "red",
                "blue",
            ],
        }
    )
    with pytest.raises(ValueError, match="not numerical"):
        prepare_regression_data(df, target_column="target")


def test_regression_rejects_insufficient_rows():
    """Datasets with fewer than 10 complete rows must fail gracefully."""
    df = pd.DataFrame({"x": [1.0, 2.0, 3.0], "y": [10.0, 20.0, 30.0]})
    with pytest.raises(ValueError, match="At least 10 rows"):
        prepare_regression_data(df, target_column="y")
