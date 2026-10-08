"""Analysis execution service and result caching."""

import json
import threading
import time

from app.analysis.pipeline.runner import run_full_analysis
from app.core.config import settings
from app.core.logging import logger
from app.services.dataset_service import session_store


class AnalysisResultCache:
    """Thread-safe cache for completed analysis payloads."""

    def __init__(self, max_items: int = 20, ttl_seconds: int = 3600):
        self.max_items = max_items
        self.ttl = ttl_seconds
        self._cache: dict[str, tuple[float, dict]] = {}
        self._lock = threading.RLock()

    def put(self, analysis_id: str, payload: dict):
        with self._lock:
            now = time.monotonic()
            for key in list(self._cache):
                if now - self._cache[key][0] > self.ttl:
                    del self._cache[key]
            size = len(json.dumps(payload).encode())
            # Python dict/list overhead exceeds wire JSON size; conservatively budget 4x.
            size *= 4
            if size > settings.MAX_CACHE_MEMORY_BYTES:
                return
            self._cache.pop(analysis_id, None)
            while self._cache and (len(self._cache) >= self.max_items or
                sum(len(json.dumps(e[1]).encode()) * 4 for e in self._cache.values()) + size > settings.MAX_CACHE_MEMORY_BYTES):
                del self._cache[min(self._cache, key=lambda k: self._cache[k][0])]
            self._cache[analysis_id] = (now, payload)

    def get(self, analysis_id: str) -> dict | None:
        with self._lock:
            entry = self._cache.get(analysis_id)
            if not entry:
                return None
            ts, payload = entry
            if time.monotonic() - ts > self.ttl:
                del self._cache[analysis_id]
                return None
            return payload


result_cache = AnalysisResultCache(
    max_items=settings.MAX_CACHED_DATASETS,
    ttl_seconds=settings.DATASET_CACHE_TTL_SECONDS,
)


def execute_analysis(dataset_id: str, target_column: str | None = None, owner: str | None = None) -> dict:
    """Retrieves dataset from session, executes master analysis, and caches result."""
    entry = session_store.get(dataset_id, owner)
    if not entry:
        raise ValueError(
            f"Dataset session '{dataset_id}' has expired or does not exist. Please re-upload."
        )

    df, name = entry
    existing = result_cache.get(dataset_id)
    if existing and existing.get("requested_target") == target_column:
        return existing
    logger.info("Starting analysis with %d rows", len(df))

    payload = run_full_analysis(df, dataset_name=name, user_target=target_column)
    payload["dataset_id"] = dataset_id
    payload["requested_target"] = target_column

    # Cache under dataset_id (or dataset_id + target key)
    result_cache.put(dataset_id, payload)

    return payload


def get_cached_result(dataset_id: str) -> dict | None:
    """Fetches already computed analysis payload."""
    return result_cache.get(dataset_id)
