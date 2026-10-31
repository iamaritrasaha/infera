"""Principal Component Analysis (PCA) projection and feature loadings."""

from dataclasses import dataclass

import numpy as np
import pandas as pd
from sklearn.decomposition import PCA
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler

from app.core.config import settings


@dataclass
class PCALoading:
    """Weight of an original feature on a principal component."""

    feature: str
    pc1_loading: float
    pc2_loading: float


@dataclass
class PCAResult:
    """Artifacts from PCA decomposition."""

    features_analyzed: list[str]
    explained_variance_ratio: list[float]  # e.g. [0.45, 0.28]
    cumulative_variance_explained: float
    loadings: list[PCALoading]
    points_2d: list[dict[str, float]]
    summary: str
    sample_count: int
    excluded_missing_rows: int


def compute_pca(df: pd.DataFrame, numerical_cols: list[str]) -> PCAResult | None:
    """Executes 2-component PCA on scaled numerical columns."""
    numerical_cols = [c for c in numerical_cols if df[c].nunique() > 1]
    clean = df[numerical_cols].dropna()
    excluded_missing = len(df) - len(clean)
    if len(clean) > settings.MAX_MODEL_ROWS:
        clean = clean.sample(settings.MAX_MODEL_ROWS, random_state=42)
    if len(clean) < 10 or len(numerical_cols) < 2:
        return None

    imputer = SimpleImputer(strategy="median")
    scaler = StandardScaler()
    x_imputed = imputer.fit_transform(clean)
    x_scaled = scaler.fit_transform(x_imputed)

    pca = PCA(n_components=2, random_state=42)
    coords = pca.fit_transform(x_scaled)

    evr = [round(float(v), 4) for v in pca.explained_variance_ratio_]
    cum_evr = round(float(np.sum(evr)), 4)

    # Feature loadings
    loadings: list[PCALoading] = []
    components = pca.components_  # shape: (2, n_features)
    for idx, col in enumerate(numerical_cols):
        loadings.append(
            PCALoading(
                feature=col,
                pc1_loading=round(float(components[0, idx]), 4),
                pc2_loading=round(float(components[1, idx]), 4),
            )
        )

    # Sort loadings by absolute PC1 contribution
    loadings.sort(key=lambda x: abs(x.pc1_loading), reverse=True)

    # Subsample 2D points (max 100 points)
    step = max(1, int(np.ceil(len(coords) / 100)))
    points: list[dict[str, float]] = []
    for i in range(0, len(coords), step):
        points.append(
            {
                "pc1": round(float(coords[i, 0]), 3),
                "pc2": round(float(coords[i, 1]), 3),
            }
        )

    summary = (
        f"Top 2 Principal Components account for {cum_evr * 100:.1f}% of total feature variance "
        f"(PC1: {evr[0] * 100:.1f}%, PC2: {evr[1] * 100:.1f}%). "
        f"Primary driver of PC1 is '{loadings[0].feature}' (loading = {loadings[0].pc1_loading:+.2f})."
    )

    return PCAResult(
        features_analyzed=numerical_cols,
        explained_variance_ratio=evr,
        cumulative_variance_explained=cum_evr,
        loadings=loadings,
        points_2d=points,
        summary=summary,
        sample_count=len(clean), excluded_missing_rows=excluded_missing,
    )
