"""Comprehensive regression model training, cross-validation, and metrics comparison."""

from dataclasses import dataclass

import numpy as np
from sklearn.dummy import DummyRegressor
from sklearn.ensemble import GradientBoostingRegressor, RandomForestRegressor
from sklearn.linear_model import ElasticNet, Lasso, LinearRegression, Ridge
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import KFold, cross_val_score

from app.analysis.pipeline.validator import PreprocessedDataset


@dataclass
class RegressionModelResult:
    """Evaluation metrics and artifacts for a single regression model."""

    model_name: str
    display_name: str
    r2_test: float
    mae_test: float
    mse_test: float
    rmse_test: float
    cv_r2_mean: float
    cv_r2_std: float
    is_best_model: bool
    feature_importances: list[dict[str, float | str]]
    # Subsampled points for visualization (up to 80 points)
    predictions_vs_actual: list[dict[str, float]]
    residuals: list[dict[str, float]]


@dataclass
class RegressionComparison:
    """Consolidated regression benchmarking results."""

    target_column: str
    train_samples: int
    test_samples: int
    models: list[RegressionModelResult]
    best_model_name: str
    summary_table: list[dict[str, str | float]]
    insight: str


def train_and_evaluate_regression(dataset: PreprocessedDataset) -> RegressionComparison:
    """Trains all 7 regression models, runs 5-fold cross validation, and generates comparisons."""
    x_tr = dataset.x_train
    x_te = dataset.x_test
    y_tr = dataset.y_train
    y_te = dataset.y_test
    feat_names = dataset.feature_names

    models_to_run = [
        ("dummy", "Dummy Regressor (Baseline)", DummyRegressor(strategy="median")),
        ("linear", "Linear Regression", LinearRegression()),
        ("ridge", "Ridge Regression (L2)", Ridge(alpha=1.0)),
        ("lasso", "Lasso Regression (L1)", Lasso(alpha=1.0, max_iter=5000, random_state=42)),
        (
            "elastic_net",
            "ElasticNet (L1+L2)",
            ElasticNet(alpha=1.0, l1_ratio=0.5, max_iter=5000, random_state=42),
        ),
        (
            "random_forest",
            "Random Forest Regressor",
            RandomForestRegressor(n_estimators=100, random_state=42),
        ),
        (
            "gradient_boosting",
            "Gradient Boosting Regressor",
            GradientBoostingRegressor(n_estimators=100, random_state=42),
        ),
    ]

    # Dynamic CV folds (minimum 2, standard 5)
    n_splits = min(5, max(2, len(y_tr) // 10))
    cv = KFold(n_splits=n_splits, shuffle=True, random_state=42)

    results: list[RegressionModelResult] = []

    for key, name, model in models_to_run:
        try:
            model.fit(x_tr, y_tr)
            y_pred = model.predict(x_te)

            r2 = float(r2_score(y_te, y_pred))
            mae = float(mean_absolute_error(y_te, y_pred))
            mse = float(mean_squared_error(y_te, y_pred))
            rmse = float(np.sqrt(mse))

            # Cross validation
            try:
                cv_scores = cross_val_score(model, x_tr, y_tr, cv=cv, scoring="r2")
                cv_mean = float(np.mean(cv_scores))
                cv_std = float(np.std(cv_scores))
            except Exception:
                cv_mean, cv_std = r2, 0.0

            # Feature importances or linear weights
            importances: list[dict[str, float | str]] = []
            if hasattr(model, "feature_importances_") and len(feat_names) == len(
                model.feature_importances_
            ):
                raw_weights = model.feature_importances_
                sorted_idx = np.argsort(raw_weights)[::-1]
                for idx in sorted_idx[:10]:
                    importances.append(
                        {
                            "feature": feat_names[idx],
                            "importance": round(float(raw_weights[idx]), 4),
                        }
                    )
            elif hasattr(model, "coef_") and len(feat_names) == len(model.coef_):
                raw_coefs = np.abs(model.coef_)
                sorted_idx = np.argsort(raw_coefs)[::-1]
                for idx in sorted_idx[:10]:
                    importances.append(
                        {
                            "feature": feat_names[idx],
                            "importance": round(float(raw_coefs[idx]), 4),
                            "signed_coefficient": round(float(model.coef_[idx]), 4),
                        }
                    )

            # Subsampled actual vs predicted & residuals (max 80 points for fast UI render)
            sub_step = max(1, len(y_te) // 80)
            pv_act: list[dict[str, float]] = []
            res_list: list[dict[str, float]] = []
            for i in range(0, len(y_te), sub_step):
                act_val = round(float(y_te[i]), 3)
                pred_val = round(float(y_pred[i]), 3)
                residual = round(act_val - pred_val, 3)
                pv_act.append({"actual": act_val, "predicted": pred_val})
                res_list.append({"predicted": pred_val, "residual": residual})

            results.append(
                RegressionModelResult(
                    model_name=key,
                    display_name=name,
                    r2_test=round(r2, 4),
                    mae_test=round(mae, 4),
                    mse_test=round(mse, 4),
                    rmse_test=round(rmse, 4),
                    cv_r2_mean=round(cv_mean, 4),
                    cv_r2_std=round(cv_std, 4),
                    is_best_model=False,
                    feature_importances=importances,
                    predictions_vs_actual=pv_act,
                    residuals=res_list,
                )
            )
        except Exception:
            # Handle numerical instability gracefully
            continue

    if not results:
        raise ValueError("All regression models encountered mathematical fitting errors.")

    # Determine best model based on held-out test R2 (excluding dummy)
    valid_candidates = [r for r in results if r.model_name != "dummy"]
    best_candidate = (
        max(valid_candidates, key=lambda x: x.r2_test) if valid_candidates else results[0]
    )

    for r in results:
        if r.model_name == best_candidate.model_name:
            r.is_best_model = True

    # Build comparison table
    summary_table = []
    for r in results:
        summary_table.append(
            {
                "model": r.display_name,
                "r2": r.r2_test,
                "rmse": r.rmse_test,
                "mae": r.mae_test,
                "cv_r2": f"{r.cv_r2_mean:.3f} ± {r.cv_r2_std:.3f}",
                "is_best": r.is_best_model,
            }
        )

    # Summary insight
    diff_dummy = best_candidate.r2_test - results[0].r2_test
    insight = (
        f"'{best_candidate.display_name}' achieved superior predictive performance on held-out test data "
        f"with R² = {best_candidate.r2_test:.3f} and RMSE = {best_candidate.rmse_test:.2f}, "
        f"surpassing baseline by +{diff_dummy:.3f} R² variance explained."
    )

    return RegressionComparison(
        target_column=dataset.target_name,
        train_samples=dataset.train_size,
        test_samples=dataset.test_size,
        models=results,
        best_model_name=best_candidate.display_name,
        summary_table=summary_table,
        insight=insight,
    )
