"""Anonymous session ownership independent of public dataset identifiers."""

import hashlib
from typing import Annotated

from fastapi import Header, HTTPException


def require_session(
    token: Annotated[str | None, Header(alias="X-Infera-Session")] = None,
) -> str:
    if token is None:
        raise HTTPException(401, "Your analysis session is missing. Reload and try again.")
    if not 32 <= len(token) <= 128 or not token.isascii() or not all(
        c.isalnum() or c in "_-" for c in token
    ):
        raise HTTPException(403, "Invalid analysis session. Reload and try again.")
    return hashlib.sha256(token.encode()).hexdigest()
