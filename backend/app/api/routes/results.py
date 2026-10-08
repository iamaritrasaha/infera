"""Results retrieval and downloadable report export endpoints."""

import re
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path, Query, Response, status

from app.core.security import require_session
from app.models.schemas import AnalysisResponse
from app.services.analysis_service import get_cached_result
from app.services.dataset_service import session_store

router = APIRouter(prefix="/api/results", tags=["Results & Reports"])


@router.get("/{dataset_id}", response_model=AnalysisResponse)
def get_analysis_results(
    owner: Annotated[str, Depends(require_session)],
    dataset_id: str = Path(..., pattern=r"^[a-zA-Z0-9_\-]{8,64}$"),
) -> AnalysisResponse:
    """Retrieves full cached analysis results for a dataset session."""
    payload = get_cached_result(dataset_id) if session_store.get(dataset_id, owner) else None
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No completed analysis found for dataset '{dataset_id}'. Please run analysis first.",
        )
    return AnalysisResponse(**payload)


@router.get("/{dataset_id}/report")
def download_report(
    owner: Annotated[str, Depends(require_session)],
    dataset_id: str = Path(..., pattern=r"^[a-zA-Z0-9_\-]{8,64}$"),
    format: str = Query("markdown", pattern="^(markdown|html)$"),
) -> Response:
    """Exports and downloads an evidence report as Markdown (.md) or standalone HTML (.html)."""
    payload = get_cached_result(dataset_id) if session_store.get(dataset_id, owner) else None
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No completed analysis found for dataset '{dataset_id}'.",
        )

    raw_name = payload.get("dataset_name", "infera_report")
    safe_name = re.sub(r"[^a-zA-Z0-9_\-]", "_", str(raw_name)).strip("_")[:50] or "infera_report"
    reports = payload.get("reports", {})

    if format == "markdown":
        content = reports.get("markdown", "# Infera Analysis Report\nNo markdown report available.")
        headers = {"Content-Disposition": f'attachment; filename="{safe_name}_evidence_report.md"', "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"}
        return Response(content=content, media_type="text/markdown", headers=headers)
    else:
        content = reports.get(
            "html", "<h1>Infera Analysis Report</h1><p>No HTML report available.</p>"
        )
        headers = {
            "Content-Disposition": f'attachment; filename="{safe_name}_evidence_report.html"',
            "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff",
            "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
        }
        return Response(content=content, media_type="text/html", headers=headers)
