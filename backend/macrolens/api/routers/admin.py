"""Administration hors périmètre du plan — mode maintenance et annonce pour
un déploiement public à un seul administrateur (ADR 0008). Pas de compte
utilisateur, pas de rôles : un unique jeton porteur (`ADMIN_TOKEN`) comparé
en temps constant, à la manière d'un mot de passe d'accès plutôt que d'une
authentification multi-utilisateur — proportionné à l'usage réel."""

from __future__ import annotations

import hashlib
import os
import secrets
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy import ColumnElement, func, select
from sqlalchemy.orm import Session

from macrolens.api.deps import get_db
from macrolens.api.schemas.admin import (
    ActivityItem,
    ActivityOut,
    AnalyticsOut,
    DailyCount,
    EventPing,
    LoginRequest,
    LoginResponse,
    RankingsOut,
    RankItem,
    StatusOut,
    StatusUpdate,
    ViewPing,
)
from macrolens.db.models import PageView, SiteStatus, UsageEvent

router = APIRouter(tags=["admin"])

STATUS_ROW_ID = 1


def _get_or_create_status(session: Session) -> SiteStatus:
    row = session.get(SiteStatus, STATUS_ROW_ID)
    if row is None:
        row = SiteStatus(
            id=STATUS_ROW_ID,
            maintenance_mode=False,
            maintenance_message=None,
            announcement=None,
            updated_at=datetime.now(UTC),
        )
        session.add(row)
        session.commit()
        session.refresh(row)
    return row


def _admin_token() -> str | None:
    return os.environ.get("ADMIN_TOKEN") or None


def require_admin(authorization: str | None = Header(default=None)) -> None:
    """§ADR 0008 : refuse par défaut si `ADMIN_TOKEN` n'est pas configuré —
    jamais de mot de passe implicite/devinable en production. Comparaison
    en temps constant (`secrets.compare_digest`), pas `==`, pour ne pas
    exposer la longueur du jeton via une attaque temporelle."""
    token = _admin_token()
    if token is None:
        raise HTTPException(
            status_code=503, detail="Administration non configurée (ADMIN_TOKEN absent)."
        )
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Jeton manquant.")
    provided = authorization.removeprefix("Bearer ")
    if not secrets.compare_digest(provided, token):
        raise HTTPException(status_code=401, detail="Jeton invalide.")


@router.get("/status", response_model=StatusOut)
def get_status(session: Session = Depends(get_db)) -> SiteStatus:
    """Public, jamais gaté par le mode maintenance lui-même — sinon
    personne ne pourrait jamais savoir pourquoi le site est fermé."""
    return _get_or_create_status(session)


@router.post("/admin/login", response_model=LoginResponse)
def admin_login(body: LoginRequest) -> LoginResponse:
    token = _admin_token()
    if token is None:
        raise HTTPException(
            status_code=503, detail="Administration non configurée (ADMIN_TOKEN absent)."
        )
    if not secrets.compare_digest(body.token, token):
        raise HTTPException(status_code=401, detail="Jeton invalide.")
    return LoginResponse(ok=True)


@router.put("/admin/status", response_model=StatusOut, dependencies=[Depends(require_admin)])
def update_status(body: StatusUpdate, session: Session = Depends(get_db)) -> SiteStatus:
    row = _get_or_create_status(session)
    row.maintenance_mode = body.maintenance_mode
    row.maintenance_message = body.maintenance_message
    row.announcement = body.announcement
    row.updated_at = datetime.now(UTC)
    session.commit()
    session.refresh(row)
    return row


@router.post("/analytics/view", status_code=204)
def record_view(body: ViewPing, session: Session = Depends(get_db)) -> None:
    """Public : un ping par chargement de page (§ADR 0011). `client_id` est
    un UUID aléatoire généré et conservé côté navigateur (localStorage),
    jamais une adresse IP — compte les appareils distincts sans collecter
    de donnée personnelle."""
    session.add(PageView(client_id=body.client_id, viewed_at=datetime.now(UTC), path=body.path))
    session.commit()


@router.get("/admin/analytics", response_model=AnalyticsOut, dependencies=[Depends(require_admin)])
def get_analytics(session: Session = Depends(get_db)) -> AnalyticsOut:
    total_views = session.execute(select(func.count()).select_from(PageView)).scalar_one()
    unique_devices = session.execute(
        select(func.count(func.distinct(PageView.client_id)))
    ).scalar_one()

    seven_days_ago = datetime.now(UTC) - timedelta(days=7)
    views_7d = session.execute(
        select(func.count()).select_from(PageView).where(PageView.viewed_at >= seven_days_ago)
    ).scalar_one()
    unique_7d = session.execute(
        select(func.count(func.distinct(PageView.client_id))).where(
            PageView.viewed_at >= seven_days_ago
        )
    ).scalar_one()

    thirty_days_ago = datetime.now(UTC) - timedelta(days=30)
    day_col = func.date(PageView.viewed_at)
    rows = session.execute(
        select(
            day_col.label("day"),
            func.count().label("views"),
            func.count(func.distinct(PageView.client_id)).label("unique_devices"),
        )
        .where(PageView.viewed_at >= thirty_days_ago)
        .group_by(day_col)
        .order_by(day_col)
    ).all()
    daily = [
        DailyCount(date=str(r.day), views=r.views, unique_devices=r.unique_devices) for r in rows
    ]

    return AnalyticsOut(
        total_views=total_views,
        unique_devices=unique_devices,
        views_last_7_days=views_7d,
        unique_devices_last_7_days=unique_7d,
        daily=daily,
    )


@router.post("/analytics/event", status_code=204)
def record_event(body: EventPing, session: Session = Depends(get_db)) -> None:
    """Public, comme `/analytics/view` : une page ouverte ou une recherche lancée (ADR 0028)."""
    session.add(
        UsageEvent(
            client_id=body.client_id,
            occurred_at=datetime.now(UTC),
            kind=body.kind,
            name=body.name,
            detail=body.detail,
        )
    )
    session.commit()


def _device_label(client_id: str) -> str:
    """Empreinte de six caractères : distingue les visiteurs entre eux sans exposer l'UUID."""
    return hashlib.sha256(client_id.encode()).hexdigest()[:6]


@router.get("/admin/activity", response_model=ActivityOut, dependencies=[Depends(require_admin)])
def get_activity(
    limit: int = Query(100, ge=1, le=500), session: Session = Depends(get_db)
) -> ActivityOut:
    """Journal horodaté, du plus récent au plus ancien : chargements du site, pages ouvertes,
    recherches. Fusion de `page_views` (historique déjà collecté) et de `usage_events`."""
    views = session.execute(
        select(PageView).order_by(PageView.viewed_at.desc(), PageView.id.desc()).limit(limit)
    ).scalars()
    events = session.execute(
        select(UsageEvent)
        .order_by(UsageEvent.occurred_at.desc(), UsageEvent.id.desc())
        .limit(limit)
    ).scalars()
    items = [
        ActivityItem(
            at=v.viewed_at,
            kind="visit",
            name=v.path,
            detail=None,
            device=_device_label(v.client_id),
        )
        for v in views
    ] + [
        ActivityItem(
            at=e.occurred_at,
            kind="search" if e.kind == "search" else "page",
            name=e.name,
            detail=e.detail,
            device=_device_label(e.client_id),
        )
        for e in events
    ]
    items.sort(key=lambda i: i.at, reverse=True)
    return ActivityOut(events=items[:limit])


def _ranking(
    session: Session,
    kind: str,
    since: datetime | None,
    name_expr: ColumnElement[str] | None = None,
    only_country_labels: bool = False,
    top: int = 10,
) -> list[RankItem]:
    name_col = name_expr if name_expr is not None else UsageEvent.name
    stmt = (
        select(
            name_col.label("n"),
            func.count().label("c"),
            func.count(func.distinct(UsageEvent.client_id)).label("d"),
        )
        .where(UsageEvent.kind == kind)
        .group_by(name_col)
        .order_by(func.count().desc(), name_col)
        .limit(top)
    )
    if since is not None:
        stmt = stmt.where(UsageEvent.occurred_at >= since)
    if only_country_labels:
        # « SWE 1991 » compte pour SWE ; « manual » n'a pas de pays et reste hors du classement.
        stmt = stmt.where(UsageEvent.name.op("~")("^[A-Z]{3}( |$)"))
    return [RankItem(name=r.n, count=r.c, devices=r.d) for r in session.execute(stmt).all()]


@router.get("/admin/rankings", response_model=RankingsOut, dependencies=[Depends(require_admin)])
def get_rankings(
    days: int = Query(30, ge=0, le=3650), session: Session = Depends(get_db)
) -> RankingsOut:
    """Classements : pages les plus ouvertes, recherches les plus lancées (étiquette complète),
    pays les plus recherchés. `days=0` : depuis le début."""
    since = datetime.now(UTC) - timedelta(days=days) if days else None
    # Pays : premier mot d'une étiquette de recherche (« SWE 1991 » → « SWE »).
    country = func.split_part(UsageEvent.name, " ", 1)
    return RankingsOut(
        days=days,
        pages=_ranking(session, "page", since),
        searches=_ranking(session, "search", since),
        countries=_ranking(session, "search", since, name_expr=country, only_country_labels=True),
    )


def deny_if_maintenance(session: Session = Depends(get_db)) -> None:
    """Barrière côté API pour la recherche d'analogues — défense en
    profondeur si quelqu'un appelle l'API directement en contournant le
    frontend (qui bloque déjà l'UI entière sur GET /status, voir App.tsx).
    Les endpoints de lecture pure (meta, coverage, sources) restent
    disponibles pendant la maintenance : consultables, pas de risque."""
    stmt = select(SiteStatus).where(SiteStatus.id == STATUS_ROW_ID)
    row = session.execute(stmt).scalar_one_or_none()
    if row is not None and row.maintenance_mode:
        raise HTTPException(
            status_code=503, detail=row.maintenance_message or "Site en maintenance."
        )
