"""Data hygiene and health scoring."""

from app.analysis.profiler.duplicates import DuplicateProfile
from app.analysis.profiler.missing import MissingProfile
from app.analysis.profiler.outliers import OutlierProfile


def compute_health_score(
    missing: MissingProfile,
    duplicates: DuplicateProfile,
    outliers: OutlierProfile,
) -> int:
    """Computes a deterministic 0-100 data hygiene score."""
    score = 100.0
    # Penalty for missing data
    score -= missing.overall_missing_percentage * 1.5
    # Penalty for duplicate rows
    score -= duplicates.duplicate_rows_percentage * 2.0
    # Penalty for outliers
    score -= min(15.0, outliers.total_iqr_outliers * 0.15)
    return max(0, min(100, int(round(score))))
