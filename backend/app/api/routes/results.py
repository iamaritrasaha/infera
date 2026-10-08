"""Results retrieval and downloadable report export endpoints."""

from fastapi import APIRouter, HTTPException, Query, Response, status

from app.models.schemas import AnalysisResponse
from app.services.analysis_service import get_cached_result

router = APIRouter(prefix="/api/results", tags=["Results & Reports"])


@router.get("/{dataset_id}", response_model=AnalysisResponse)
def get_analysis_results(dataset_id: str) -> AnalysisResponse:
    """Retrieves full cached analysis results for a dataset session."""
    payload = get_cached_result(dataset_id)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No completed analysis found for dataset '{dataset_id}'. Please run analysis first.",
        )
    return AnalysisResponse(**payload)


@router.get("/{dataset_id}/report")
def download_report(
    dataset_id: str,
    format: str = Query("markdown", pattern="^(markdown|html)$"),
) -> Response:
    """Exports and downloads an evidence report as Markdown (.md) or standalone HTML (.html)."""
    payload = get_cached_result(dataset_id)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No completed analysis found for dataset '{dataset_id}'.",
        )

    name = payload.get("dataset_name", "infera_report").replace(" ", "_").lower()
    reports = payload.get("reports", {})

    if format == "markdown":
        content = reports.get("markdown", "# Infera Analysis Report\nNo markdown report available.")
        headers = {"Content-Disposition": f"attachment; filename={name}_evidence_report.md"}
        return Response(content=content, media_type="text/markdown", headers=headers)
    else:
        content = reports.get(
            "html", "<h1>Infera Analysis Report</h1><p>No HTML report available.</p>"
        )
        headers = {"Content-Disposition": f"attachment; filename={name}_evidence_report.html"}
        return Response(content=content, media_type="text/html", headers=headers)
