import resource
import sys
import time

from fastapi import APIRouter

from app.core.config import settings
from app.models.schemas import DiagnosticResponse, HealthResponse

router = APIRouter(tags=["Health"])

_START_TIME = time.time()


@router.get("/health", response_model=HealthResponse)
@router.get("/api/health", response_model=HealthResponse)
def health_check() -> HealthResponse:
    """Service health and liveness probe."""
    return HealthResponse(
        status="ok",
        project=settings.PROJECT_NAME,
        version=settings.VERSION,
        engine_status="ready",
        timestamp=round(time.time(), 3),
    )


@router.get("/", response_model=HealthResponse)
def root() -> HealthResponse:
    """Root liveness endpoint."""
    return health_check()


@router.get("/diagnostic", response_model=DiagnosticResponse)
@router.get("/api/diagnostic", response_model=DiagnosticResponse)
def diagnostic() -> DiagnosticResponse:
    """Safe operational diagnostics without exposing sensitive data."""
    uptime = time.time() - _START_TIME
    try:
        usage = resource.getrusage(resource.RUSAGE_SELF)
        memory_mb = round(usage.ru_maxrss / 1024.0, 2)
    except Exception:
        memory_mb = None
    return DiagnosticResponse(
        status="ok",
        project=settings.PROJECT_NAME,
        version=settings.VERSION,
        uptime_seconds=round(uptime, 1),
        memory_mb=memory_mb,
        python_version=sys.version.split()[0],
        max_concurrent_analyses=settings.MAX_CONCURRENT_ANALYSES,
        environment="production" if not settings.DEBUG else "development",
    )
