"""Infera Automated Data Science Platform - Backend Application."""

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes import analysis, exploration, health, results, samples, upload
from app.core.config import settings
from app.core.limits import UploadLimitMiddleware
from app.core.logging import logger


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown hooks."""
    logger.info(
        f"Starting {settings.PROJECT_NAME} v{settings.VERSION} on {settings.HOST}:{settings.PORT}"
    )
    yield
    logger.info(f"Shutting down {settings.PROJECT_NAME} service.")


def create_app() -> FastAPI:
    """Builds and configures the FastAPI application instance."""
    app = FastAPI(
        title=settings.PROJECT_NAME,
        version=settings.VERSION,
        description="Automated Data Science Platform - Turn data into evidence.",
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=lifespan,
    )

    app.add_middleware(UploadLimitMiddleware)
    # CORS wraps upload rejection responses as well.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=False,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Content-Type", "X-Infera-Session", "X-Request-ID"],
        expose_headers=["Content-Disposition", "Retry-After", "X-Request-ID", "X-Response-Time-Ms"],
    )

    # Observability and request duration tracking
    @app.middleware("http")
    async def observability_headers(request: Request, call_next):
        import time
        import uuid

        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        start = time.perf_counter()
        response = await call_next(request)
        duration_ms = (time.perf_counter() - start) * 1000.0
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Response-Time-Ms"] = f"{duration_ms:.2f}"
        return response

    # Private results must not be shared through browser or intermediary caches.
    @app.middleware("http")
    async def private_response_headers(request: Request, call_next):
        response = await call_next(request)
        if request.url.path.startswith("/api/"):
            response.headers["Cache-Control"] = "no-store"
            response.headers["X-Content-Type-Options"] = "nosniff"
            if request.headers.get("X-Infera-Session"):
                response.headers["Vary"] = ", ".join(filter(None, [response.headers.get("Vary"), "X-Infera-Session"]))
        return response

    # Register API Routers
    app.include_router(health.router)
    app.include_router(upload.router)
    app.include_router(samples.router)
    app.include_router(analysis.router)
    app.include_router(exploration.router)
    app.include_router(results.router)

    # Human-friendly global exception handling
    @app.exception_handler(ValueError)
    async def value_error_handler(request: Request, exc: ValueError):
        logger.warning("Validation error on %s", request.url.path)
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"detail": str(exc)},
        )

    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        logger.error("Internal error on %s (%s)", request.url.path, type(exc).__name__)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "detail": (
                    "Infera encountered an error processing your request. "
                    "You can still inspect the dataset schema, data quality, and distributions."
                ),
            },
        )

    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=settings.DEBUG)
