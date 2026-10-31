"""Dataset loading, sanitization, memory caching, and sample dataset provision."""

import csv
import io
import re
import threading
import time
import uuid
import zipfile

import pandas as pd

from app.core.config import settings
from app.core.logging import logger


class DatasetSessionStore:
    """Thread-safe in-memory cache for active analysis datasets with TTL expiration."""

    def __init__(self, max_items: int = 20, ttl_seconds: int = 3600):
        self.max_items = max_items
        self.ttl = ttl_seconds
        self._store: dict[str, tuple[float, pd.DataFrame, str, str]] = {}
        self._lock = threading.RLock()

    def put(self, df: pd.DataFrame, name: str, owner: str) -> str:
        with self._lock:
            self._cleanup()
            size = int(df.memory_usage(deep=True).sum())
            if size > settings.MAX_DATASET_MEMORY_BYTES:
                raise ValueError("Decoded dataset exceeds the memory limit. Upload a smaller sample.")
            while self._store and (
                len(self._store) >= self.max_items
                or sum(int(e[1].memory_usage(deep=True).sum()) for e in self._store.values())
                + size > settings.MAX_CACHE_MEMORY_BYTES
            ):
                oldest = min(self._store, key=lambda k: self._store[k][0])
                del self._store[oldest]
            dataset_id = str(uuid.uuid4())
            self._store[dataset_id] = (time.monotonic(), df, name, owner)
            logger.info("Cached dataset with %d rows and %d columns", len(df), len(df.columns))
            return dataset_id

    def get(self, dataset_id: str, owner: str | None = None) -> tuple[pd.DataFrame, str] | None:
        with self._lock:
            self._cleanup()
            entry = self._store.get(dataset_id)
            if not entry or (owner is not None and entry[3] != owner):
                return None
            _, df, name, stored_owner = entry
            self._store[dataset_id] = (time.monotonic(), df, name, stored_owner)
            return df, name

    def _cleanup(self):
        now = time.monotonic()
        # Evict expired
        expired = [k for k, (ts, _, _, _) in self._store.items() if now - ts > self.ttl]
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
    if not content or not content.strip():
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
            if b"\x00" in content:
                raise ValueError("CSV contains binary content.")
            # Inspect the original header before Pandas can rename duplicate columns.
            try:
                decoded = content.decode("utf-8-sig")
            except UnicodeDecodeError:
                decoded = content.decode("latin1")
            original_header = next(csv.reader(io.StringIO(decoded)))
            trimmed_header = [c.strip() for c in original_header]
            if len(set(trimmed_header)) != len(trimmed_header) or any(not c for c in trimmed_header):
                raise ValueError("CSV column names must be non-empty and unique.")
            # Attempt UTF-8, fallback to Latin-1
            try:
                df = pd.read_csv(io.BytesIO(content), encoding="utf-8", nrows=settings.MAX_ROW_COUNT + 1)
            except UnicodeDecodeError:
                df = pd.read_csv(io.BytesIO(content), encoding="latin1", nrows=settings.MAX_ROW_COUNT + 1)
        elif ext == "xlsx":
            with zipfile.ZipFile(io.BytesIO(content)) as archive:
                if sum(f.file_size for f in archive.infolist()) > 64 * 1024 * 1024:
                    raise ValueError("Spreadsheet expands beyond the decoded size limit.")
            df = pd.read_excel(io.BytesIO(content), engine="openpyxl", nrows=settings.MAX_ROW_COUNT + 1)
        elif ext == "json":
            df = pd.read_json(io.BytesIO(content))
        elif ext == "parquet":
            import pyarrow.parquet as pq

            metadata = pq.ParquetFile(io.BytesIO(content)).metadata
            if metadata.num_rows > settings.MAX_ROW_COUNT or metadata.num_columns > settings.MAX_COLUMN_COUNT:
                raise ValueError("Parquet dimensions exceed the row or column limit.")
            if sum(metadata.row_group(i).total_byte_size for i in range(metadata.num_row_groups)) > settings.MAX_DATASET_MEMORY_BYTES:
                raise ValueError("Parquet expands beyond the decoded memory limit.")
            df = pd.read_parquet(io.BytesIO(content))
        else:
            raise ValueError(f"No parser available for '.{ext}'.")
    except Exception as e:
        logger.warning("Dataset parser rejected %s input (%s)", ext, type(e).__name__)
        raise ValueError("Unable to parse dataset. Check the format, table dimensions, and decoded size limits.") from e

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
    if len(set(df.columns)) != len(df.columns) or any(not c or len(c) > 100 for c in df.columns):
        raise ValueError("Column names must be non-empty, unique after trimming, and at most 100 characters.")
    for col in [c for c in df if not pd.api.types.is_numeric_dtype(df[c])]:
        if df[col].map(lambda v: isinstance(v, (list, dict, tuple, set))).any():
            raise ValueError("Nested values are unsupported. Upload a flat table with scalar cells.")
    import numpy as np

    if any(np.isinf(df[col]).any() for col in df.select_dtypes(include="number").columns):
        raise ValueError("Numerical columns contain infinite values. Replace them with finite values or blanks.")
    if int(df.memory_usage(deep=True).sum()) > settings.MAX_DATASET_MEMORY_BYTES:
        raise ValueError("Decoded dataset exceeds the memory limit. Upload a smaller sample.")

    return df


def safe_dataset_name(filename: str) -> str:
    basename = filename.replace("\\", "/").rsplit("/", 1)[-1].rsplit(".", 1)[0]
    return re.sub(r"[\x00-\x1f\x7f]", "", basename).strip()[:100] or "Dataset"


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
            "description": "Subscriber account tenure, services, and billing contracts. Suitable for binary classification and class balance analysis.",
            "filename": "customer_churn.csv",
            "recommended_target": "churned",
            "suggested_problem_type": "binary_classification",
        },
        {
            "id": "student_performance",
            "name": "Student Exam Performance",
            "description": "Study habits, attendance, and exam scores. Suitable for multiclass tier prediction or continuous score regression.",
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
