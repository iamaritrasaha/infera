"""Health check and service status endpoints."""

from fastapi import APIRouter

from app.core.config import settings
from app.models.schemas import HealthResponse

router = APIRouter(tags=["Health"])


@router.get("/health", response_model=HealthResponse)
@router.get("/api/health", response_model=HealthResponse)
def health_check() -> HealthResponse:
    """Service health and liveness probe."""
    return HealthResponse(
        status="ok",
        project=settings.PROJECT_NAME,
        version=settings.VERSION,
    )


@router.get("/", response_model=HealthResponse)
def root() -> HealthResponse:
    """Root liveness endpoint."""
    return health_check()
