"""Compatibility shim exposing the refactored Infera FastAPI application."""

from infera.main import app

__all__ = ["app"]
