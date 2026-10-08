"""Data validation, leakage prevention, stratified partitioning, and preprocessor composition."""

import math
from dataclasses import dataclass

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

from app.core.config import settings


@dataclass
class PreprocessedDataset:
    """Rigorous split and transformed data representation."""

    x_train: np.ndarray
    x_test: np.ndarray
    y_train: np.ndarray
    y_test: np.ndarray
    x_train_raw: pd.DataFrame
    preprocessor: ColumnTransformer
    feature_names: list[str]
    train_size: int
    test_size: int
    has_class_imbalance: bool
    imbalance_warning: str | None
    class_labels: list[str] | None
    target_name: str
    preparation: dict


def prepare_supervised_data(
    df: pd.DataFrame,
    target_col: str,
    feature_cols: list[str],
    is_classification: bool = False,
    test_size: float = 0.2,
    random_state: int = 42,
) -> PreprocessedDataset:
    """Prepares clean, isolated train/test sets with leakage-free preprocessing."""
    # Drop rows where target is missing
    if target_col not in df.columns or target_col in feature_cols:
        raise ValueError("Target must exist and cannot also be a predictor.")
    clean_df = df.dropna(subset=[target_col]).drop_duplicates(subset=[target_col, *feature_cols]).copy()
    preparation = {"original_rows": len(df), "missing_target_rows": int(df[target_col].isna().sum()),
                   "duplicate_rows_removed": int(df.dropna(subset=[target_col]).duplicated(subset=[target_col, *feature_cols]).sum())}
    if len(clean_df) < 5:
        raise ValueError(
            f"Insufficient valid rows ({len(clean_df)}) for modeling on target '{target_col}'. Minimum 5 required."
        )

    y_raw = clean_df[target_col]
    x_raw = clean_df[[c for c in feature_cols if c in clean_df.columns]]

    has_imbalance = False
    imbalance_warning = None
    class_labels = None

    if is_classification:
        # Check class balance
        val_counts = y_raw.value_counts(normalize=True)
        if len(val_counts) < 2:
            raise ValueError(
                f"Classification target '{target_col}' requires at least 2 distinct classes in data (found {len(val_counts)})."
            )

        minority_prop = float(val_counts.min())
        majority_prop = float(val_counts.max())
        class_labels = [str(k) for k in val_counts.index]

        if minority_prop < 0.20 and len(val_counts) == 2:
            has_imbalance = True
            imbalance_warning = (
                f"Severe class imbalance: minority class '{val_counts.index[-1]}' represents only "
                f"{minority_prop * 100:.1f}% of data (ratio 1:{majority_prop / minority_prop:.1f}). "
                "Accuracy will be misleading; emphasize Precision, Recall, and F1-Score."
            )

        # Encode target classes as integers if needed
        y_raw = y_raw.astype(str)
        classes = sorted(y_raw.unique())
        class_to_idx = {c: i for i, c in enumerate(classes)}
        y_array = np.array([class_to_idx[v] for v in y_raw], dtype=int)
        class_labels = [str(c) for c in classes]

        if y_raw.value_counts().min() < 2:
            raise ValueError("Each target class requires at least 2 observations for a stratified holdout.")
        if len(clean_df) > settings.MAX_MODEL_ROWS:
            selected, _ = train_test_split(np.arange(len(y_array)), train_size=settings.MAX_MODEL_ROWS,
                                          random_state=random_state, stratify=y_array)
            x_raw, y_array = x_raw.iloc[selected], y_array[selected]
        n_test = max(len(classes), math.ceil(len(y_array) * test_size))
        if len(y_array) - n_test < len(classes):
            raise ValueError("Insufficient observations to represent every class in training and holdout sets.")
        x_tr, x_te, y_tr, y_te = train_test_split(
            x_raw, y_array, test_size=n_test, random_state=random_state, stratify=y_array
        )
    else:
        y_numeric = pd.to_numeric(y_raw, errors="coerce")
        valid_idx = y_numeric.notna()
        if valid_idx.sum() < 5:
            raise ValueError(
                f"Target '{target_col}' contains insufficient numeric values for regression (minimum 5 required)."
            )
        x_raw = x_raw.loc[valid_idx]
        y_array = y_numeric.loc[valid_idx].values
        if not np.isfinite(y_array).all() or len(np.unique(y_array)) < 2:
            raise ValueError("Regression requires a finite, varying numerical target.")
        if len(y_array) < 10:
            raise ValueError("Regression requires at least 10 valid, distinct observations for evaluation.")
        if len(y_array) > settings.MAX_MODEL_ROWS:
            selected = np.random.default_rng(random_state).choice(len(y_array), settings.MAX_MODEL_ROWS, replace=False)
            x_raw, y_array = x_raw.iloc[selected], y_array[selected]

        x_tr, x_te, y_tr, y_te = train_test_split(
            x_raw, y_array, test_size=test_size, random_state=random_state
        )

    # Feature selection is learned from the training partition only.
    num_features = [c for c in x_tr if pd.api.types.is_numeric_dtype(x_tr[c])]
    cat_features = [c for c in x_tr if c not in num_features and 1 <= x_tr[c].nunique() <= 50]
    if not num_features and not cat_features:
        raise ValueError("No valid numerical or low-cardinality categorical predictors available.")
    preparation["excluded_features"] = [c for c in x_tr if c not in num_features + cat_features]
    preparation["modeled_rows"] = len(y_array)
    preparation["sampling"] = "Deterministic representative sample" if len(clean_df) > len(y_array) else "All eligible rows"
    estimated_bytes = len(y_array) * (len(num_features) + len(cat_features) * 20) * 8 * 3
    if estimated_bytes > settings.MAX_ENCODED_MEMORY_BYTES:
        raise ValueError("Encoded feature matrix exceeds the memory budget. Use fewer categorical predictors or a smaller sample.")

    # Build ColumnTransformer
    transformers = []
    if num_features:
        num_pipeline = [
            ("imputer", SimpleImputer(strategy="median", keep_empty_features=True)),
            ("scaler", StandardScaler()),
        ]
        transformers.append(("num", Pipeline(num_pipeline), num_features))

    if cat_features:
        cat_pipeline = [
            ("imputer", SimpleImputer(strategy="most_frequent", keep_empty_features=True)),
            (
                "encoder",
                OneHotEncoder(handle_unknown="ignore", sparse_output=False, max_categories=20),
            ),
        ]
        transformers.append(("cat", Pipeline(cat_pipeline), cat_features))

    preprocessor = ColumnTransformer(transformers=transformers, remainder="drop")

    # Fit strictly on train set to prevent data leakage
    x_train_trans = preprocessor.fit_transform(x_tr)
    x_test_trans = preprocessor.transform(x_te)

    # Extract feature names
    feature_names = preprocessor.get_feature_names_out().tolist()

    return PreprocessedDataset(
        x_train=np.asarray(x_train_trans, dtype=float),
        x_test=np.asarray(x_test_trans, dtype=float),
        y_train=np.asarray(y_tr),
        y_test=np.asarray(y_te),
        x_train_raw=x_tr,
        preprocessor=preprocessor,
        feature_names=feature_names,
        train_size=len(x_tr),
        test_size=len(x_te),
        has_class_imbalance=has_imbalance,
        imbalance_warning=imbalance_warning,
        class_labels=class_labels,
        target_name=target_col,
        preparation=preparation,
    )
