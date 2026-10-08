"""Unsupervised clustering analysis (K-Means & DBSCAN) with 2D projections."""

from dataclasses import dataclass

import numpy as np
import pandas as pd
from sklearn.cluster import DBSCAN, KMeans
from sklearn.decomposition import PCA
from sklearn.impute import SimpleImputer
from sklearn.metrics import silhouette_score
from sklearn.preprocessing import StandardScaler


@dataclass
class ClusterProfile:
    """Summary of a single discovered cluster segment."""

    cluster_id: int
    name: str  # e.g., "Potential Segment 1"
    size: int
    percentage: float
    feature_means: dict[str, float]


@dataclass
class ClusterResult:
    """Artifacts from a clustering algorithm execution."""

    algorithm_name: str
    num_clusters: int
    silhouette: float | None
    cluster_profiles: list[ClusterProfile]
    noise_count: int  # For DBSCAN
    scatter_2d: list[dict[str, float | int | str]]  # PCA projection points with cluster assignment


@dataclass
class ClusteringSuiteResult:
    """Consolidated unsupervised segmentation benchmarking."""

    features_used: list[str]
    sample_count: int
    optimal_k: int
    kmeans_result: ClusterResult
    dbscan_result: ClusterResult | None
    summary_insight: str


def run_clustering_suite(
    df: pd.DataFrame, numerical_cols: list[str]
) -> ClusteringSuiteResult | None:
    """Executes K-Means with silhouette selection, DBSCAN, and 2D PCA visual projections."""
    # Ensure clean numeric data
    clean_num = df[numerical_cols].dropna()
    if len(clean_num) < 15 or len(numerical_cols) < 2:
        return None

    # Preprocess
    imputer = SimpleImputer(strategy="median")
    scaler = StandardScaler()
    x_raw = imputer.fit_transform(clean_num)
    x_scaled = scaler.fit_transform(x_raw)
    n_samples = len(x_scaled)

    # 2D PCA for visualization coordinates
    pca = PCA(n_components=2, random_state=42)
    x_pca = pca.fit_transform(x_scaled)

    # 1. K-Means: Evaluate k from 2 to min(6, n_samples - 1)
    max_k = min(6, n_samples - 1)
    best_k = 2
    best_sil = -1.0
    best_labels = None

    for k in range(2, max_k + 1):
        km = KMeans(n_clusters=k, random_state=42, n_init=10)
        labels = km.fit_predict(x_scaled)
        try:
            sil_samp = min(1000, n_samples) if n_samples > 1000 else None
            sil = float(silhouette_score(x_scaled, labels, sample_size=sil_samp, random_state=42))
            if sil > best_sil:
                best_sil = sil
                best_k = k
                best_labels = labels
        except Exception:
            continue

    if best_labels is None:
        km = KMeans(n_clusters=2, random_state=42, n_init=10)
        best_labels = km.fit_predict(x_scaled)
        best_k = 2
        best_sil = 0.0

    # Build K-Means Cluster Profiles
    km_profiles: list[ClusterProfile] = []
    for cid in range(best_k):
        mask = best_labels == cid
        c_size = int(np.sum(mask))
        c_pct = round((c_size / n_samples) * 100.0, 2)
        f_means = {}
        for idx, col in enumerate(numerical_cols):
            f_means[col] = round(float(np.mean(x_raw[mask, idx])), 3) if c_size > 0 else 0.0

        km_profiles.append(
            ClusterProfile(
                cluster_id=cid,
                name=f"Potential Segment {cid + 1}",
                size=c_size,
                percentage=c_pct,
                feature_means=f_means,
            )
        )

    # Subsample 2D points for UI visualization
    sub_step = max(1, n_samples // 120)
    km_scatter: list[dict[str, float | int | str]] = []
    for i in range(0, n_samples, sub_step):
        km_scatter.append(
            {
                "pca_x": round(float(x_pca[i, 0]), 3),
                "pca_y": round(float(x_pca[i, 1]), 3),
                "cluster": int(best_labels[i]),
                "cluster_label": f"Segment {best_labels[i] + 1}",
            }
        )

    km_result = ClusterResult(
        algorithm_name="K-Means",
        num_clusters=best_k,
        silhouette=round(best_sil, 4) if best_sil >= 0 else None,
        cluster_profiles=km_profiles,
        noise_count=0,
        scatter_2d=km_scatter,
    )

    # 2. DBSCAN
    dbscan_result: ClusterResult | None = None
    try:
        db = DBSCAN(eps=1.2, min_samples=max(3, int(np.log(n_samples))))
        db_labels = db.fit_predict(x_scaled)
        unique_db = set(db_labels) - {-1}
        noise_count = int(np.sum(db_labels == -1))

        if len(unique_db) >= 1:
            db_sil = None
            if len(unique_db) > 1 and (n_samples - noise_count) > len(unique_db):
                try:
                    non_noise = db_labels != -1
                    n_non_noise = int(np.sum(non_noise))
                    sil_samp = min(1000, n_non_noise) if n_non_noise > 1000 else None
                    db_sil = float(
                        silhouette_score(
                            x_scaled[non_noise],
                            db_labels[non_noise],
                            sample_size=sil_samp,
                            random_state=42,
                        )
                    )
                except Exception:
                    db_sil = None

            db_profiles: list[ClusterProfile] = []
            for cid in sorted(unique_db):
                mask = db_labels == cid
                c_size = int(np.sum(mask))
                c_pct = round((c_size / n_samples) * 100.0, 2)
                f_means = {}
                for idx, col in enumerate(numerical_cols):
                    f_means[col] = round(float(np.mean(x_raw[mask, idx])), 3) if c_size > 0 else 0.0

                db_profiles.append(
                    ClusterProfile(
                        cluster_id=cid,
                        name=f"Dense Region {cid + 1}",
                        size=c_size,
                        percentage=c_pct,
                        feature_means=f_means,
                    )
                )

            db_scatter: list[dict[str, float | int | str]] = []
            for i in range(0, n_samples, sub_step):
                c_val = int(db_labels[i])
                c_str = f"Dense {c_val + 1}" if c_val >= 0 else "Noise/Outlier"
                db_scatter.append(
                    {
                        "pca_x": round(float(x_pca[i, 0]), 3),
                        "pca_y": round(float(x_pca[i, 1]), 3),
                        "cluster": c_val,
                        "cluster_label": c_str,
                    }
                )

            dbscan_result = ClusterResult(
                algorithm_name="DBSCAN",
                num_clusters=len(unique_db),
                silhouette=round(db_sil, 4) if db_sil is not None else None,
                cluster_profiles=db_profiles,
                noise_count=noise_count,
                scatter_2d=db_scatter,
            )
    except Exception:
        dbscan_result = None

    summary = (
        f"K-Means identified k={best_k} optimal potential segments (Silhouette = {best_sil:.3f}). "
        "Segments represent empirical cluster boundaries rather than inherent domain archetypes."
    )

    return ClusteringSuiteResult(
        features_used=numerical_cols,
        sample_count=n_samples,
        optimal_k=best_k,
        kmeans_result=km_result,
        dbscan_result=dbscan_result,
        summary_insight=summary,
    )
