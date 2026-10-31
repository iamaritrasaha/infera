# Infera Backend Dockerfile (Python 3.12)
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install uv for dependency management
COPY --from=ghcr.io/astral-sh/uv:0.12.22 /uv /usr/local/bin/uv

# Copy project specification files
COPY pyproject.toml README.md ./
COPY infera/ ./infera/
COPY sample_data/ ./sample_data/

# Install dependencies into system environment
RUN uv pip install --system --no-cache -e .

# Run as non-root user
RUN useradd -m inferauser && chown -R inferauser:inferauser /app
USER inferauser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:${PORT}/health || exit 1

CMD ["sh", "-c", "exec uvicorn infera.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
