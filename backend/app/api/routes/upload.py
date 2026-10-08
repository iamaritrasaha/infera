"""Bounded dataset uploads, immediate profiling, and anonymous ownership."""

import asyncio
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from app.api.routes.analysis import _get_semaphore
from app.core.config import settings
from app.core.security import require_session
from app.models.schemas import UploadResponse
from app.services.dataset_service import parse_dataset_bytes, safe_dataset_name
from app.services.profiling_service import profile_and_store

router = APIRouter(prefix="/api", tags=["Upload"])


@router.post("/upload", response_model=UploadResponse, status_code=201)
async def upload_dataset(
    owner: Annotated[str, Depends(require_session)],
    file: UploadFile = File(...),
) -> UploadResponse:
    filename = file.filename or "dataset.csv"
    semaphore = _get_semaphore()
    acquired = False
    try:
        ext = filename.rsplit(".", 1)[-1].lower()
        if ext not in settings.ALLOWED_EXTENSIONS:
            raise HTTPException(400, "Unsupported file format. Use CSV, XLSX, JSON, or Parquet.")
        try:
            await asyncio.wait_for(semaphore.acquire(), settings.ANALYSIS_SEMAPHORE_TIMEOUT_SECONDS)
            acquired = True
        except TimeoutError:
            raise HTTPException(429, "The analysis engine is at capacity. Please retry shortly.", headers={"Retry-After": "10"})
        content = bytearray()
        while chunk := await file.read(64 * 1024):
            if len(content) + len(chunk) > settings.MAX_UPLOAD_SIZE_BYTES:
                raise HTTPException(413, "Upload exceeds the allowed file size.")
            content.extend(chunk)

        def parse_and_profile():
            df = parse_dataset_bytes(bytes(content), filename)
            return profile_and_store(df, safe_dataset_name(filename), owner)

        # Keep the capacity permit until the worker actually stops, even if the client disconnects.
        task = asyncio.create_task(asyncio.to_thread(parse_and_profile))
        try:
            return await asyncio.shield(task)
        except asyncio.CancelledError:
            await task
            raise
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    finally:
        await file.close()
        if acquired:
            semaphore.release()
