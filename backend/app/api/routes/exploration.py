"""Session-owned endpoints for bounded interactive data exploration."""

import asyncio
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from app.analysis.exploration import column_options, explore_dataframe
from app.api.routes.analysis import _get_semaphore
from app.core.config import settings
from app.core.security import require_session
from app.models.schemas import (
    ExplorationOptionsRequest,
    ExplorationOptionsResponse,
    ExplorationResponse,
    ExploreRequest,
)
from app.services.dataset_service import session_store

router = APIRouter(prefix="/api/explore", tags=["Interactive Exploration"])


async def _with_capacity(fn, *args):
    semaphore = _get_semaphore()
    try:
        await asyncio.wait_for(semaphore.acquire(), timeout=settings.ANALYSIS_SEMAPHORE_TIMEOUT_SECONDS)
    except TimeoutError as exc:
        raise HTTPException(
            429,
            "The analysis engine is at capacity. Please retry shortly.",
            headers={"Retry-After": "10"},
        ) from exc
    task = asyncio.create_task(asyncio.to_thread(fn, *args))
    try:
        return await asyncio.shield(task)
    except asyncio.CancelledError:
        await task
        raise
    finally:
        semaphore.release()


def _owned_dataset(dataset_id: str, owner: str):
    entry = session_store.get(dataset_id, owner)
    if not entry:
        raise HTTPException(404, "Dataset is unavailable in this session or has expired. Please re-upload.")
    return entry[0]


@router.post("/options", response_model=ExplorationOptionsResponse)
async def get_exploration_options(
    request: ExplorationOptionsRequest,
    owner: Annotated[str, Depends(require_session)],
) -> ExplorationOptionsResponse:
    """Return bounded options for one filter selector, after checking session ownership."""
    df = _owned_dataset(request.dataset_id, owner)
    try:
        options = await _with_capacity(column_options, df, request.column)
        return ExplorationOptionsResponse(**options)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc


@router.post("", response_model=ExplorationResponse)
async def explore_dataset(
    request: ExploreRequest,
    owner: Annotated[str, Depends(require_session)],
) -> ExplorationResponse:
    """Compute group comparisons, date trends, or numerical associations on filtered rows."""
    df = _owned_dataset(request.dataset_id, owner)
    try:
        result = await _with_capacity(explore_dataframe, df, request)
        return ExplorationResponse(**result)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
