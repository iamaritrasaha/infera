"""Application configuration and settings."""

import json
from pathlib import Path
from typing import Any

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Infera backend settings."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    PROJECT_NAME: str = "Infera"
    VERSION: str = "0.4.0"
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    DEBUG: bool = False

    # CORS origins
    CORS_ORIGINS: list[str] | str = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://infera-omega.vercel.app",
    ]

    # Free-tier constraints & limits
    MAX_UPLOAD_SIZE_BYTES: int = Field(15 * 1024 * 1024, gt=0)
    MAX_ROW_COUNT: int = Field(50_000, gt=0)
    MAX_COLUMN_COUNT: int = Field(100, gt=0)
    MAX_DATASET_MEMORY_BYTES: int = Field(32 * 1024 * 1024, gt=0)
    MAX_CACHE_MEMORY_BYTES: int = Field(64 * 1024 * 1024, gt=0)
    MAX_ENCODED_MEMORY_BYTES: int = Field(32 * 1024 * 1024, gt=0)
    MAX_MODEL_ROWS: int = Field(5000, ge=100)
    MAX_CLUSTER_ROWS: int = Field(1500, ge=100)
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
    DATASET_CACHE_TTL_SECONDS: int = Field(3600, gt=0)
    MAX_CACHED_DATASETS: int = Field(20, gt=0)

    # Concurrency and rate protection on free tier
    MAX_CONCURRENT_ANALYSES: int = Field(1, gt=0)
    ANALYSIS_SEMAPHORE_TIMEOUT_SECONDS: float = Field(10.0, gt=0)


settings = Settings()
