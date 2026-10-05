from __future__ import annotations

from datetime import datetime
from typing import Literal

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


class EventPing(APIModel):
    """Page ouverte ou recherche lancée (ADR 0028). Le nom d'une page est un identifiant de vue
    (`scenario`, `episode`…), celui d'une recherche une étiquette courte (« SWE 1991 »)."""

    client_id: str = Field(min_length=1, max_length=100)
    kind: Literal["page", "search"]
    name: str = Field(min_length=1, max_length=80)
    detail: str | None = Field(default=None, max_length=200)


class ActivityItem(APIModel):
    at: datetime
    kind: Literal["visit", "page", "search"]
    name: str | None
    detail: str | None
    # Empreinte courte et opaque de l'appareil : relie les lignes d'un même visiteur sans exposer
    # son identifiant.
    device: str


class ActivityOut(APIModel):
    events: list[ActivityItem]


class RankItem(APIModel):
    name: str
    count: int
    devices: int


class RankingsOut(APIModel):
    days: int
    pages: list[RankItem]
    searches: list[RankItem]
    countries: list[RankItem]
