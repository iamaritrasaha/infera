"""Comprehensive regression model training, cross-validation, and metrics comparison."""

from dataclasses import dataclass

import numpy as np
from sklearn.base import clone
from sklearn.compose import TransformedTargetRegressor
from sklearn.dummy import DummyRegressor
from sklearn.ensemble import GradientBoostingRegressor, RandomForestRegressor
from sklearn.linear_model import ElasticNet, Lasso, LinearRegression, Ridge
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import KFold, cross_val_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

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
    cv_r2_mean: float | None
    cv_r2_std: float | None
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
    preparation: dict
    cv_folds: int
    selection_method: str
    failed_models: list[str]


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
        (
            "lasso",
            "Lasso Regression (L1)",
            TransformedTargetRegressor(
                regressor=Lasso(alpha=0.01, max_iter=5000, random_state=42),
                transformer=StandardScaler(),
            ),
        ),
        (
            "elastic_net",
            "ElasticNet (L1+L2)",
            TransformedTargetRegressor(
                regressor=ElasticNet(alpha=0.01, l1_ratio=0.5, max_iter=5000, random_state=42),
                transformer=StandardScaler(),
            ),
        ),
        (
            "random_forest",
            "Random Forest Regressor",
            RandomForestRegressor(n_estimators=50, max_depth=8, n_jobs=1, random_state=42),
        ),
        (
            "gradient_boosting",
            "Gradient Boosting Regressor",
            GradientBoostingRegressor(n_estimators=50, max_depth=6, random_state=42),
        ),
    ]

    # Dynamic CV folds (minimum 2, standard 5)
    if len(y_tr) >= 4:
        n_splits = min(5, max(2, len(y_tr) // 10))
        cv = KFold(n_splits=n_splits, shuffle=True, random_state=42)
    else:
        cv = None

    failed_models: list[str] = []
    results: list[RegressionModelResult] = []

    for key, name, model in models_to_run:
        try:
            model.fit(x_tr, y_tr)
            y_pred = model.predict(x_te)

            r2 = float(r2_score(y_te, y_pred))
            mae = float(mean_absolute_error(y_te, y_pred))
            mse = float(mean_squared_error(y_te, y_pred))
            rmse = float(np.sqrt(mse))

            # Cross validation with preprocessing fitted strictly inside each fold
            if (
                cv is not None
                and hasattr(dataset, "preprocessor")
                and hasattr(dataset, "x_train_raw")
            ):
                try:
                    cv_pipeline = Pipeline(
                        [("preprocessor", clone(dataset.preprocessor)), ("model", clone(model))]
                    )
                    cv_scores = cross_val_score(
                        cv_pipeline, dataset.x_train_raw, y_tr, cv=cv, scoring="r2", error_score="raise"
                    )
                    if not np.isfinite(cv_scores).all():
                        raise ValueError("CV score unavailable")
                    cv_mean = float(np.mean(cv_scores))
                    cv_std = float(np.std(cv_scores))
                except Exception:
                    cv_mean, cv_std = None, None
            else:
                cv_mean, cv_std = None, None

            # Feature importances or linear weights
            importances: list[dict[str, float | str]] = []
            base_estimator = getattr(model, "regressor_", model)
            if hasattr(base_estimator, "feature_importances_") and len(feat_names) == len(
                base_estimator.feature_importances_
            ):
                raw_weights = base_estimator.feature_importances_
                sorted_idx = np.argsort(raw_weights)[::-1]
                for idx in sorted_idx[:10]:
                    importances.append(
                        {
                            "feature": feat_names[idx],
                            "importance": round(float(raw_weights[idx]), 4),
                        }
                    )
            elif hasattr(base_estimator, "coef_") and len(feat_names) == len(base_estimator.coef_):
                raw_coefs = np.abs(base_estimator.coef_)
                sorted_idx = np.argsort(raw_coefs)[::-1]
                for idx in sorted_idx[:10]:
                    importances.append(
                        {
                            "feature": feat_names[idx],
                            "importance": round(float(raw_coefs[idx]), 4),
                            "signed_coefficient": round(float(base_estimator.coef_[idx]), 4),
                        }
                    )

            # Subsampled actual vs predicted & residuals (max 80 points for fast UI render)
            sub_step = max(1, int(np.ceil(len(y_te) / 80)))
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
                    cv_r2_mean=round(cv_mean, 4) if cv_mean is not None else None,
                    cv_r2_std=round(cv_std, 4) if cv_std is not None else None,
                    is_best_model=False,
                    feature_importances=importances,
                    predictions_vs_actual=pv_act,
                    residuals=res_list,
                )
            )
        except Exception:
            failed_models.append(name)
            continue

    if not results:
        raise ValueError("All regression models encountered mathematical fitting errors.")

    cv_candidates = [r for r in results if r.cv_r2_mean is not None]
    best_candidate = max(cv_candidates, key=lambda r: r.cv_r2_mean) if cv_candidates else max(results, key=lambda r: r.r2_test)
    selection_method = "Training cross-validation R²" if cv_candidates else "Holdout R² (CV unavailable; selection may be optimistic)"

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
                "cv_r2": f"{r.cv_r2_mean:.3f} ± {r.cv_r2_std:.3f}" if r.cv_r2_mean is not None else "Unavailable",
                "is_best": r.is_best_model,
            }
        )

    baseline = next((r for r in results if r.model_name == "dummy"), None)
    delta = best_candidate.r2_test - baseline.r2_test if baseline else None
    insight = (
        f"'{best_candidate.display_name}' selected by {selection_method}. "
        f"Holdout R² = {best_candidate.r2_test:.3f}, MAE = {best_candidate.mae_test:.2f}, RMSE = {best_candidate.rmse_test:.2f}. "
        + (f"Difference from the median baseline: {delta:+.3f} R². " if delta is not None else "Baseline unavailable. ")
        + "These estimates describe this split, not proven performance on new datasets."
    )

    return RegressionComparison(
        target_column=dataset.target_name,
        train_samples=dataset.train_size,
        test_samples=dataset.test_size,
        models=results,
        best_model_name=best_candidate.display_name,
        summary_table=summary_table,
        insight=insight,
        preparation=dataset.preparation,
        cv_folds=cv.n_splits if cv is not None else 0,
        selection_method=selection_method,
        failed_models=failed_models,
    )
