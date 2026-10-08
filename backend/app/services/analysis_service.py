"""Analysis execution service and result caching."""

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

    def put(self, analysis_id: str, payload: dict):
        now = time.time()
        self._cache[analysis_id] = (now, payload)
        if len(self._cache) > self.max_items:
            oldest = sorted(self._cache.items(), key=lambda item: item[1][0])[0][0]
            del self._cache[oldest]

    def get(self, analysis_id: str) -> dict | None:
        entry = self._cache.get(analysis_id)
        if not entry:
            return None
        ts, payload = entry
        if time.time() - ts > self.ttl:
            del self._cache[analysis_id]
            return None
        return payload


result_cache = AnalysisResultCache(
    max_items=settings.MAX_CACHED_DATASETS,
    ttl_seconds=settings.DATASET_CACHE_TTL_SECONDS,
)


def execute_analysis(dataset_id: str, target_column: str | None = None) -> dict:
    """Retrieves dataset from session, executes master analysis, and caches result."""
    entry = session_store.get(dataset_id)
    if not entry:
        raise ValueError(
            f"Dataset session '{dataset_id}' has expired or does not exist. Please re-upload."
        )

    df, name = entry
    logger.info(
        f"Initiating full analysis on dataset '{name}' ({len(df)} rows, target: '{target_column}')"
    )

    payload = run_full_analysis(df, dataset_name=name, user_target=target_column)
    payload["dataset_id"] = dataset_id

    # Cache under dataset_id (or dataset_id + target key)
    cache_key = f"{dataset_id}_{target_column or 'auto'}"
    result_cache.put(cache_key, payload)
    result_cache.put(dataset_id, payload)

    return payload


def get_cached_result(dataset_id: str) -> dict | None:
    """Fetches already computed analysis payload."""
    return result_cache.get(dataset_id)
