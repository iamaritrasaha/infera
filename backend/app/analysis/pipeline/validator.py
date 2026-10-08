"""Data validation, leakage prevention, stratified partitioning, and preprocessor composition."""

from dataclasses import dataclass

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler


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
    clean_df = df.dropna(subset=[target_col]).copy()
    if len(clean_df) < 5:
        raise ValueError(
            f"Insufficient valid rows ({len(clean_df)}) for modeling on target '{target_col}'. Minimum 5 required."
        )

    y_raw = clean_df[target_col]
    x_raw = clean_df[[c for c in feature_cols if c in clean_df.columns]]

    # Identify numeric vs categorical feature subsets
    num_features = []
    cat_features = []
    for col in x_raw.columns:
        if pd.api.types.is_numeric_dtype(x_raw[col]):
            num_features.append(col)
        else:
            nunique = x_raw[col].nunique(dropna=True)
            # Safeguard Render Free 512MB RAM: omit high-cardinality text/id columns (>50 unique)
            if 1 < nunique <= 50:
                cat_features.append(col)

    if not num_features and not cat_features:
        raise ValueError(
            "No valid numerical or low-cardinality categorical predictor features available for modeling."
        )

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
        classes = sorted(y_raw.unique())
        class_to_idx = {c: i for i, c in enumerate(classes)}
        y_array = np.array([class_to_idx[v] for v in y_raw], dtype=int)
        class_labels = [str(c) for c in classes]

        # Stratified train/test split if possible
        try:
            x_tr, x_te, y_tr, y_te = train_test_split(
                x_raw, y_array, test_size=test_size, random_state=random_state, stratify=y_array
            )
        except Exception:
            x_tr, x_te, y_tr, y_te = train_test_split(
                x_raw, y_array, test_size=test_size, random_state=random_state
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

        x_tr, x_te, y_tr, y_te = train_test_split(
            x_raw, y_array, test_size=test_size, random_state=random_state
        )

    # Build ColumnTransformer
    transformers = []
    if num_features:
        num_pipeline = [
            ("imputer", SimpleImputer(strategy="median")),
            ("scaler", StandardScaler()),
        ]
        transformers.append(("num", Pipeline(num_pipeline), num_features))

    if cat_features:
        cat_pipeline = [
            ("imputer", SimpleImputer(strategy="most_frequent")),
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
    feature_names: list[str] = []
    if num_features:
        feature_names.extend(num_features)
    if cat_features:
        try:
            cat_encoder = preprocessor.named_transformers_["cat"].named_steps["encoder"]
            encoded_cats = cat_encoder.get_feature_names_out(cat_features).tolist()
            feature_names.extend(encoded_cats)
        except Exception:
            for c in cat_features:
                feature_names.append(f"{c}_encoded")

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
    )
