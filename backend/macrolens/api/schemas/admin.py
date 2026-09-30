from __future__ import annotations

from pydantic import Field

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


class ViewPing(APIModel):
    client_id: str = Field(max_length=100)
    path: str | None = Field(default=None, max_length=100)


class DailyCount(APIModel):
    date: str
    views: int
    unique_devices: int


class AnalyticsOut(APIModel):
    total_views: int
    unique_devices: int
    views_last_7_days: int
    unique_devices_last_7_days: int
    daily: list[DailyCount]
