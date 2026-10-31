# Infera Production Backend Dockerfile (Python 3.12)
# Optimized for free-tier deployments (e.g. Render Free)

FROM python:3.12-slim

# Prevent Python from writing .pyc files and enable unbuffered logging
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000 \
    OMP_NUM_THREADS=1 \
    OPENBLAS_NUM_THREADS=1 \
    MKL_NUM_THREADS=1

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Install uv for ultra-fast dependency management
COPY --from=ghcr.io/astral-sh/uv:0.12.22 /uv /usr/local/bin/uv

# Copy project specification files
COPY backend/pyproject.toml backend/README.md backend/requirements.txt backend/requirements.lock ./
COPY backend/app/ ./app/

# Install dependencies into system environment
RUN uv pip install --system --no-cache -r requirements.txt && uv pip install --system --no-cache --no-deps .

# Copy application code and sample datasets
COPY sample_data/ /app/sample_data/

# Run as non-root user for security
RUN useradd -m inferauser && chown -R inferauser:inferauser /app
USER inferauser

# Expose HTTP port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:${PORT}/health || exit 1

# Production start command respecting dynamic PORT
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1"]
