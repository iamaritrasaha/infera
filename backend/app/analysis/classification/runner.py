"""Comprehensive classification model training, cross-validation, and metrics comparison."""

from dataclasses import dataclass

import numpy as np
from sklearn.base import clone
from sklearn.dummy import DummyClassifier
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import StratifiedKFold, cross_val_score
from sklearn.pipeline import Pipeline

from app.analysis.pipeline.validator import PreprocessedDataset


@dataclass
class ClassificationModelResult:
    """Evaluation metrics and confusion matrix for a classification model."""

    model_name: str
    display_name: str
    accuracy_test: float
    precision_macro: float
    recall_macro: float
    f1_macro: float
    f1_weighted: float
    roc_auc: float | None
    cv_score_mean: float
    cv_score_std: float
    is_best_model: bool
    confusion_matrix: list[list[int]]
    confusion_matrix_labels: list[str]
    feature_importances: list[dict[str, float | str]]


@dataclass
class ClassificationComparison:
    """Consolidated classification benchmarking results."""

    target_column: str
    classes: list[str]
    train_samples: int
    test_samples: int
    has_class_imbalance: bool
    imbalance_warning: str | None
    models: list[ClassificationModelResult]
    best_model_name: str
    summary_table: list[dict[str, str | float | None]]
    insight: str


def train_and_evaluate_classification(dataset: PreprocessedDataset) -> ClassificationComparison:
    """Trains classification models, evaluates confusion matrices, ROC-AUC, and cross-validation."""
    x_tr = dataset.x_train
    x_te = dataset.x_test
    y_tr = dataset.y_train
    y_te = dataset.y_test
    feat_names = dataset.feature_names
    class_labels = dataset.class_labels or [str(i) for i in np.unique(y_tr)]
    n_classes = len(class_labels)

    models_to_run = [
        ("dummy", "Dummy Classifier (Baseline)", DummyClassifier(strategy="most_frequent")),
        ("logistic", "Logistic Regression", LogisticRegression(max_iter=1000, random_state=42)),
        (
            "random_forest",
            "Random Forest Classifier",
            RandomForestClassifier(n_estimators=50, max_depth=8, n_jobs=1, random_state=42),
        ),
        (
            "gradient_boosting",
            "Gradient Boosting Classifier",
            GradientBoostingClassifier(n_estimators=50, max_depth=6, random_state=42),
        ),
    ]

    # Dynamic CV folds (minimum 2, standard 5)
    counts = np.bincount(y_tr) if len(y_tr) > 0 else np.array([])
    min_class_count = int(np.min(counts)) if len(counts) > 0 else 0
    if min_class_count >= 2:
        n_splits = min(5, min_class_count)
        cv = StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=42)
    else:
        cv = None

    results: list[ClassificationModelResult] = []

    for key, name, model in models_to_run:
        try:
            model.fit(x_tr, y_tr)
            y_pred = model.predict(x_te)

            acc = float(accuracy_score(y_te, y_pred))
            prec = float(precision_score(y_te, y_pred, average="macro", zero_division=0))
            rec = float(recall_score(y_te, y_pred, average="macro", zero_division=0))
            f1_m = float(f1_score(y_te, y_pred, average="macro", zero_division=0))
            f1_w = float(f1_score(y_te, y_pred, average="weighted", zero_division=0))

            # ROC-AUC if predict_proba available
            roc_auc_val: float | None = None
            if hasattr(model, "predict_proba"):
                try:
                    proba = model.predict_proba(x_te)
                    if n_classes == 2:
                        roc_auc_val = float(roc_auc_score(y_te, proba[:, 1]))
                    else:
                        roc_auc_val = float(
                            roc_auc_score(y_te, proba, multi_class="ovr", average="macro")
                        )
                    roc_auc_val = round(roc_auc_val, 4)
                except Exception:
                    roc_auc_val = None

            # Cross validation with preprocessing fitted strictly inside each fold
            if (
                cv is not None
                and hasattr(dataset, "preprocessor")
                and hasattr(dataset, "x_train_raw")
            ):
                try:
                    cv_pipeline = Pipeline(
                        [("preprocessor", clone(dataset.preprocessor)), ("model", model)]
                    )
                    cv_scores = cross_val_score(
                        cv_pipeline, dataset.x_train_raw, y_tr, cv=cv, scoring="f1_macro"
                    )
                    cv_mean = float(np.mean(cv_scores))
                    cv_std = float(np.std(cv_scores))
                except Exception:
                    cv_mean, cv_std = f1_m, 0.0
            else:
                cv_mean, cv_std = f1_m, 0.0

            # Confusion Matrix
            cm = confusion_matrix(y_te, y_pred, labels=list(range(n_classes))).tolist()

            # Feature importances or weights
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
            elif hasattr(model, "coef_"):
                # Average abs coef across classes for multiclass or single vector for binary
                raw_coefs = (
                    np.mean(np.abs(model.coef_), axis=0)
                    if model.coef_.ndim > 1
                    else np.abs(model.coef_)
                )
                if len(feat_names) == len(raw_coefs):
                    sorted_idx = np.argsort(raw_coefs)[::-1]
                    for idx in sorted_idx[:10]:
                        importances.append(
                            {
                                "feature": feat_names[idx],
                                "importance": round(float(raw_coefs[idx]), 4),
                            }
                        )

            results.append(
                ClassificationModelResult(
                    model_name=key,
                    display_name=name,
                    accuracy_test=round(acc, 4),
                    precision_macro=round(prec, 4),
                    recall_macro=round(rec, 4),
                    f1_macro=round(f1_m, 4),
                    f1_weighted=round(f1_w, 4),
                    roc_auc=roc_auc_val,
                    cv_score_mean=round(cv_mean, 4),
                    cv_score_std=round(cv_std, 4),
                    is_best_model=False,
                    confusion_matrix=cm,
                    confusion_matrix_labels=class_labels,
                    feature_importances=importances,
                )
            )
        except Exception:
            continue

    if not results:
        raise ValueError("All classification models encountered mathematical fitting errors.")

    # Select best model based on F1-macro (especially important for imbalanced data)
    valid_candidates = [r for r in results if r.model_name != "dummy"]
    best_candidate = (
        max(valid_candidates, key=lambda x: x.f1_macro) if valid_candidates else results[0]
    )

    for r in results:
        if r.model_name == best_candidate.model_name:
            r.is_best_model = True

    # Build summary table
    summary_table = []
    for r in results:
        summary_table.append(
            {
                "model": r.display_name,
                "accuracy": f"{r.accuracy_test * 100:.1f}%",
                "f1_macro": r.f1_macro,
                "precision": r.precision_macro,
                "recall": r.recall_macro,
                "roc_auc": r.roc_auc if r.roc_auc is not None else "N/A",
                "cv_f1": f"{r.cv_score_mean:.3f} ± {r.cv_score_std:.3f}",
                "is_best": r.is_best_model,
            }
        )

    insight = (
        f"'{best_candidate.display_name}' achieved top overall classification performance with "
        f"F1-Macro = {best_candidate.f1_macro:.3f} and Accuracy = {best_candidate.accuracy_test * 100:.1f}%."
    )
    if dataset.has_class_imbalance:
        insight += " Class imbalance is present; evaluations emphasize balanced F1 and precision-recall trade-offs."

    return ClassificationComparison(
        target_column=dataset.target_name,
        classes=class_labels,
        train_samples=dataset.train_size,
        test_samples=dataset.test_size,
        has_class_imbalance=dataset.has_class_imbalance,
        imbalance_warning=dataset.imbalance_warning,
        models=results,
        best_model_name=best_candidate.display_name,
        summary_table=summary_table,
        insight=insight,
    )
