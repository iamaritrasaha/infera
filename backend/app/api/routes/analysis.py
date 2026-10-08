"""Analysis execution endpoints for automated data science pipeline."""

import asyncio

from fastapi import APIRouter, HTTPException, status

from app.core.config import settings
from app.models.schemas import AnalysisResponse, AnalyzeRequest
from app.services.analysis_service import execute_analysis

router = APIRouter(prefix="/api", tags=["Analysis"])

# Concurrency safeguard for Render Free (512MB RAM, 0.1 CPU)
_analysis_semaphore: asyncio.Semaphore | None = None


def _get_semaphore() -> asyncio.Semaphore:
    global _analysis_semaphore
    if _analysis_semaphore is None:
        _analysis_semaphore = asyncio.Semaphore(settings.MAX_CONCURRENT_ANALYSES)
    return _analysis_semaphore


@router.post("/analyze", response_model=AnalysisResponse)
async def run_analysis(request: AnalyzeRequest) -> AnalysisResponse:
    """Executes full automated profiling, statistics, hypothesis testing, and ML modeling."""
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
        )

    try:
        loop = asyncio.get_running_loop()
        # Offload CPU-heavy computation to thread pool so /health probes remain responsive
        payload = await loop.run_in_executor(
            None,
            execute_analysis,
            request.dataset_id,
            request.target_column,
        )
        return AnalysisResponse(**payload)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Infera analysis engine encountered an unexpected error: {e!s}",
        )
    finally:
        semaphore.release()
