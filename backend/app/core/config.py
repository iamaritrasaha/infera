"""Application configuration and settings."""

from pathlib import Path

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
    CORS_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://infera.vercel.app",
        "*",
    ]

    # Free-tier constraints & limits
    MAX_UPLOAD_SIZE_BYTES: int = 15 * 1024 * 1024  # 15 MB
    MAX_ROW_COUNT: int = 50_000
    MAX_COLUMN_COUNT: int = 100
    ALLOWED_EXTENSIONS: list[str] = ["csv", "xlsx", "json", "parquet"]

    # Sample data directory
    SAMPLE_DATA_DIR: Path = Path(__file__).resolve().parent.parent.parent.parent / "sample_data"

    # Temporary dataset cache TTL in seconds (in-memory LRU)
    DATASET_CACHE_TTL_SECONDS: int = 3600
    MAX_CACHED_DATASETS: int = 20


settings = Settings()
