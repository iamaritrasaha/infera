"""Synthetic sample datasets with actual dimensions and session ownership."""

import asyncio
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from app.api.routes.analysis import _get_semaphore
from app.core.config import settings
from app.core.security import require_session
from app.models.schemas import SampleDatasetInfo, UploadResponse
from app.services.dataset_service import get_sample_datasets, load_sample_dataset
from app.services.profiling_service import profile_and_store

router = APIRouter(prefix="/api/samples", tags=["Sample Datasets"])


@router.get("", response_model=list[SampleDatasetInfo])
def list_sample_datasets() -> list[SampleDatasetInfo]:
    result = []
    for sample in get_sample_datasets():
        try:
            df, _ = load_sample_dataset(sample["id"])
        except FileNotFoundError:
            continue
        result.append(SampleDatasetInfo(
            **{k: v for k, v in sample.items() if k != "filename"},
            row_count=len(df), column_count=len(df.columns),
        ))
    return result


@router.post("/{sample_id}/load", response_model=UploadResponse)
async def load_sample(sample_id: str, owner: Annotated[str, Depends(require_session)]) -> UploadResponse:
    sample = next((s for s in get_sample_datasets() if s["id"] == sample_id), None)
    if sample is None:
        raise HTTPException(404, "Sample dataset not found.")
    semaphore = _get_semaphore()
    try:
        await asyncio.wait_for(semaphore.acquire(), settings.ANALYSIS_SEMAPHORE_TIMEOUT_SECONDS)
    except TimeoutError:
        raise HTTPException(429, "The analysis engine is at capacity. Please retry shortly.", headers={"Retry-After": "10"})
    try:
        def load_and_profile():
            df, name = load_sample_dataset(sample_id)
            return profile_and_store(df, name, owner, sample["recommended_target"])
        task = asyncio.create_task(asyncio.to_thread(load_and_profile))
        try:
            return await asyncio.shield(task)
        except asyncio.CancelledError:
            await task
            raise
    except FileNotFoundError:
        raise HTTPException(503, "Sample files are unavailable on this server. Please upload a dataset.")
    finally:
        semaphore.release()
