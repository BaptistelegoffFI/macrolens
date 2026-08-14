"""Administration hors périmètre du plan — mode maintenance et annonce pour
un déploiement public à un seul administrateur (ADR 0008). Pas de compte
utilisateur, pas de rôles : un unique jeton porteur (`ADMIN_TOKEN`) comparé
en temps constant, à la manière d'un mot de passe d'accès plutôt que d'une
authentification multi-utilisateur — proportionné à l'usage réel."""

from __future__ import annotations

import os
import secrets
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from macrolens.api.deps import get_db
from macrolens.api.schemas.admin import LoginRequest, LoginResponse, StatusOut, StatusUpdate
from macrolens.db.models import SiteStatus

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
