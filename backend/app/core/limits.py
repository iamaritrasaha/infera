"""Bound incoming request streams before multipart parsing or disk spooling."""

import asyncio

from starlette.responses import JSONResponse

from app.core.config import settings


class UploadLimitMiddleware:
    def __init__(self, app):
        self.app = app
        self.upload_gate = asyncio.Semaphore(1)

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or scope["path"] != "/api/upload":
            return await self.app(scope, receive, send)
        if self.upload_gate.locked():
            return await JSONResponse({"detail": "An upload is already being processed. Please retry shortly."}, 429, headers={"Retry-After": "10"})(scope, receive, send)
        await self.upload_gate.acquire()
        limit = settings.MAX_UPLOAD_SIZE_BYTES + 64 * 1024  # multipart envelope
        headers = dict(scope.get("headers", []))
        try:
            declared = int(headers.get(b"content-length", b"0"))
        except ValueError:
            declared = 0
        response = JSONResponse({"detail": "Upload exceeds the allowed file size."}, 413)
        if declared > limit:
            self.upload_gate.release()
            return await response(scope, receive, send)
        consumed = 0

        async def bounded_receive():
            nonlocal consumed
            message = await receive()
            consumed += len(message.get("body", b""))
            if consumed > limit:
                raise UploadTooLarge
            return message

        try:
            await self.app(scope, bounded_receive, send)
        except UploadTooLarge:
            await response(scope, receive, send)
        finally:
            self.upload_gate.release()


class UploadTooLarge(Exception):
    pass
