"""ASGI entrypoint for Vercel and serverless runners."""

from app.main import app

__all__ = ["app"]
