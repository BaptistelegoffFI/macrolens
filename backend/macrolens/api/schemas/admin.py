from __future__ import annotations

from macrolens.api.schemas.base import APIModel


class StatusOut(APIModel):
    maintenance_mode: bool
    maintenance_message: str | None
    announcement: str | None


class StatusUpdate(APIModel):
    maintenance_mode: bool
    maintenance_message: str | None = None
    announcement: str | None = None


class LoginRequest(APIModel):
    token: str


class LoginResponse(APIModel):
    ok: bool
