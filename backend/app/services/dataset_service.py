"""Dataset loading, sanitization, memory caching, and sample dataset provision."""

import io
import time
import uuid

import pandas as pd

from app.core.config import settings
from app.core.logging import logger


class DatasetSessionStore:
    """Thread-safe in-memory cache for active analysis datasets with TTL expiration."""

    def __init__(self, max_items: int = 20, ttl_seconds: int = 3600):
        self.max_items = max_items
        self.ttl = ttl_seconds
        self._store: dict[str, tuple[float, pd.DataFrame, str]] = {}

    def put(self, df: pd.DataFrame, name: str) -> str:
        self._cleanup()
        dataset_id = str(uuid.uuid4())
        self._store[dataset_id] = (time.time(), df, name)
        logger.info(
            f"Cached dataset '{name}' under ID {dataset_id[:8]} (total cached: {len(self._store)})"
        )
        return dataset_id

    def get(self, dataset_id: str) -> tuple[pd.DataFrame, str] | None:
        self._cleanup()
        entry = self._store.get(dataset_id)
        if not entry:
            return None
        _, df, name = entry
        # Refresh access timestamp
        self._store[dataset_id] = (time.time(), df, name)
        return df, name

    def _cleanup(self):
        now = time.time()
        # Evict expired
        expired = [k for k, (ts, _, _) in self._store.items() if now - ts > self.ttl]
        for k in expired:
            del self._store[k]
        # Evict oldest if exceeding max_items
        if len(self._store) > self.max_items:
            oldest = sorted(self._store.items(), key=lambda item: item[1][0])[0][0]
            del self._store[oldest]


session_store = DatasetSessionStore(
    max_items=settings.MAX_CACHED_DATASETS,
    ttl_seconds=settings.DATASET_CACHE_TTL_SECONDS,
)


def parse_dataset_bytes(content: bytes, filename: str) -> pd.DataFrame:
    """Safely parses raw file bytes into a Pandas DataFrame."""
    if len(content.strip()) == 0:
        raise ValueError("Uploaded file is empty (contains zero bytes).")

    if len(content) > settings.MAX_UPLOAD_SIZE_BYTES:
        max_mb = settings.MAX_UPLOAD_SIZE_BYTES / (1024 * 1024)
        raise ValueError(f"Uploaded file exceeds maximum allowed size ({max_mb:.1f} MB).")

    ext = filename.split(".")[-1].lower() if "." in filename else ""
    if ext not in settings.ALLOWED_EXTENSIONS:
        raise ValueError(
            f"Unsupported file format '.{ext}'. Supported formats are: {', '.join(settings.ALLOWED_EXTENSIONS)}."
        )

    try:
        if ext == "csv":
            # Attempt UTF-8, fallback to Latin-1
            try:
                df = pd.read_csv(io.BytesIO(content), encoding="utf-8")
            except UnicodeDecodeError:
                df = pd.read_csv(io.BytesIO(content), encoding="latin1")
        elif ext == "xlsx":
            df = pd.read_excel(io.BytesIO(content), engine="openpyxl")
        elif ext == "json":
            df = pd.read_json(io.BytesIO(content))
        elif ext == "parquet":
            df = pd.read_parquet(io.BytesIO(content))
        else:
            raise ValueError(f"No parser available for '.{ext}'.")
    except Exception as e:
        logger.error(f"Failed to parse dataset '{filename}': {e!s}")
        raise ValueError(f"Unable to parse dataset: {e!s}")

    if len(df) == 0:
        raise ValueError("Uploaded file is empty (contains zero rows).")

    if len(df.columns) == 0:
        raise ValueError("Uploaded file contains zero columns.")

    if len(df) > settings.MAX_ROW_COUNT:
        raise ValueError(
            f"Dataset contains {len(df):,} rows, exceeding free-tier limit of {settings.MAX_ROW_COUNT:,} rows. "
            "Please upload a representative sample."
        )

    if len(df.columns) > settings.MAX_COLUMN_COUNT:
        raise ValueError(
            f"Dataset contains {len(df.columns)} columns, exceeding free-tier limit of {settings.MAX_COLUMN_COUNT} columns. "
            "Please upload a dataset with fewer columns."
        )

    # Sanitize column names: convert all to string, strip whitespace
    df.columns = [str(c).strip() for c in df.columns]

    return df


def get_sample_datasets() -> list[dict]:
    """Returns catalog of pre-packaged sample datasets."""
    return [
        {
            "id": "housing",
            "name": "Housing Prices",
            "description": "Real-estate sales with square footage, room counts, and neighborhood factors. Ideal for regression benchmarking.",
            "filename": "housing.csv",
            "recommended_target": "price",
            "suggested_problem_type": "regression",
        },
        {
            "id": "customer_churn",
            "name": "Telecom Customer Churn",
            "description": "Subscriber account tenure, services, and billing contracts. Perfect for binary classification and class balance analysis.",
            "filename": "customer_churn.csv",
            "recommended_target": "churned",
            "suggested_problem_type": "binary_classification",
        },
        {
            "id": "student_performance",
            "name": "Student Exam Performance",
            "description": "Study habits, attendance, and exam scores. Excellent for multiclass tier prediction or continuous score regression.",
            "filename": "student_performance.csv",
            "recommended_target": "performance_tier",
            "suggested_problem_type": "multiclass_classification",
        },
        {
            "id": "retail_sales",
            "name": "Weekly Retail Sales",
            "description": "Store department sales across calendar dates with economic indicators and holiday boosts. Built for time-series diagnostics.",
            "filename": "retail_sales.csv",
            "recommended_target": "weekly_sales",
            "suggested_problem_type": "time_series",
        },
    ]


def load_sample_dataset(sample_id: str) -> tuple[pd.DataFrame, str]:
    """Loads a pre-packaged sample dataset by ID."""
    catalog = {s["id"]: s for s in get_sample_datasets()}
    if sample_id not in catalog:
        raise ValueError(f"Unknown sample dataset '{sample_id}'. Available: {list(catalog.keys())}")

    entry = catalog[sample_id]
    sample_path = settings.SAMPLE_DATA_DIR / entry["filename"]
    if not sample_path.exists():
        raise FileNotFoundError(f"Sample dataset file not found at {sample_path}")

    df = pd.read_csv(sample_path)
    df.columns = [str(c).strip() for c in df.columns]
    return df, entry["name"]
