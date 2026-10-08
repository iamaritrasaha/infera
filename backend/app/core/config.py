"""Application configuration and settings."""

import json
from pathlib import Path
from typing import Any

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Infera backend settings."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    PROJECT_NAME: str = "Infera"
    VERSION: str = "0.1.0"
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    DEBUG: bool = False

    # CORS origins
    CORS_ORIGINS: list[str] | str = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://infera.vercel.app",
        "*",
    ]

    # Free-tier constraints & limits
    MAX_UPLOAD_SIZE_BYTES: int = 15 * 1024 * 1024  # 15 MB
    MAX_ROW_COUNT: int = 50_000
    MAX_COLUMN_COUNT: int = 100
    ALLOWED_EXTENSIONS: list[str] | str = ["csv", "xlsx", "json", "parquet"]

    @field_validator("CORS_ORIGINS", "ALLOWED_EXTENSIONS")
    @classmethod
    def parse_string_or_list(cls, v: Any) -> list[str]:
        if isinstance(v, str):
            v = v.strip()
            if v.startswith("[") and v.endswith("]"):
                try:
                    parsed = json.loads(v)
                    if isinstance(parsed, list):
                        return [str(item).strip() for item in parsed]
                except Exception:
                    pass
            return [part.strip() for part in v.split(",") if part.strip()]
        if isinstance(v, list):
            return [str(item).strip() for item in v]
        return v

    # Sample data directory
    SAMPLE_DATA_DIR: Path = Path(__file__).resolve().parents[3] / "sample_data"

    @field_validator("SAMPLE_DATA_DIR", mode="after")
    @classmethod
    def resolve_sample_dir(cls, v: Path) -> Path:
        if v.exists() and v.is_dir():
            return v
        base = Path(__file__).resolve()
        for parent in base.parents:
            candidate = parent / "sample_data"
            if candidate.exists() and candidate.is_dir():
                return candidate
        if Path("/app/sample_data").exists():
            return Path("/app/sample_data")
        return v

    # Temporary dataset cache TTL in seconds (in-memory LRU)
    DATASET_CACHE_TTL_SECONDS: int = 3600
    MAX_CACHED_DATASETS: int = 20

    # Concurrency and rate protection on free tier
    MAX_CONCURRENT_ANALYSES: int = 1
    ANALYSIS_SEMAPHORE_TIMEOUT_SECONDS: float = 10.0


settings = Settings()
