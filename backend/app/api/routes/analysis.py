"""Analysis execution endpoints for automated data science pipeline."""

from fastapi import APIRouter, HTTPException, status

from app.models.schemas import AnalysisResponse, AnalyzeRequest
from app.services.analysis_service import execute_analysis

router = APIRouter(prefix="/api", tags=["Analysis"])


@router.post("/analyze", response_model=AnalysisResponse)
def run_analysis(request: AnalyzeRequest) -> AnalysisResponse:
    """Executes full automated profiling, statistics, hypothesis testing, and ML modeling."""
    try:
        payload = execute_analysis(
            dataset_id=request.dataset_id,
            target_column=request.target_column,
        )
        return AnalysisResponse(**payload)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Infera analysis engine encountered an unexpected error: {e!s}",
        )
