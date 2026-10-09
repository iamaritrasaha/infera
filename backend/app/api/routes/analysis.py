"""Analysis execution endpoints for automated data science pipeline."""

import asyncio
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.config import settings
from app.core.logging import logger
from app.core.security import require_session
from app.models.schemas import AnalysisResponse, AnalyzeRequest
from app.services.analysis_service import execute_analysis
from app.services.dataset_service import session_store

router = APIRouter(prefix="/api", tags=["Analysis"])

# Concurrency safeguard for Render Free (512MB RAM, 0.1 CPU)
_analysis_semaphore: asyncio.Semaphore | None = None


def _get_semaphore() -> asyncio.Semaphore:
    global _analysis_semaphore
    if _analysis_semaphore is None:
        _analysis_semaphore = asyncio.Semaphore(settings.MAX_CONCURRENT_ANALYSES)
    return _analysis_semaphore


@router.post("/analyze", response_model=AnalysisResponse)
async def run_analysis(request: AnalyzeRequest, owner: Annotated[str, Depends(require_session)]) -> AnalysisResponse:
    """Executes full automated profiling, statistics, hypothesis testing, and ML modeling."""
    if not session_store.get(request.dataset_id, owner):
        raise HTTPException(404, "Dataset is unavailable in this session or has expired. Please re-upload.")
    semaphore = _get_semaphore()
    try:
        await asyncio.wait_for(
            semaphore.acquire(),
            timeout=settings.ANALYSIS_SEMAPHORE_TIMEOUT_SECONDS,
        )
    except TimeoutError:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=(
                "Infera free-tier engine is currently executing another analysis at capacity. "
                "Please retry in a few moments."
            ),
            headers={"Retry-After": "10"},
        )

    try:
        # Offload CPU-heavy computation to thread pool so /health probes remain responsive
        task = asyncio.create_task(
            asyncio.to_thread(
                execute_analysis,
                request.dataset_id,
                request.target_column,
                owner,
                metric_column=request.metric_column,
                date_column=request.date_column,
                group_column=request.group_column,
                question=request.question,
            )
        )
        try:
            payload = await asyncio.shield(task)
        except asyncio.CancelledError:
            await task
            raise
        return AnalysisResponse(**payload)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error("Analysis failed (%s)", type(e).__name__)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="The analysis engine could not complete this request. Please retry shortly.",
        )
    finally:
        semaphore.release()
