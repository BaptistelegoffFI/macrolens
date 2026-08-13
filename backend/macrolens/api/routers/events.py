from __future__ import annotations

import datetime as dt

from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from macrolens.api.deps import get_db
from macrolens.api.schemas.events import EventOut
from macrolens.db.models import Event

router = APIRouter(prefix="/events", tags=["events"])


@router.get("", response_model=list[EventOut])
def list_events(
    country: str | None = Query(None, min_length=3, max_length=3),
    kind: str | None = Query(None),
    from_: int | None = Query(None, alias="from"),
    to: int | None = Query(None),
    session: Session = Depends(get_db),
) -> list[Event]:
    stmt = select(Event)
    if country is not None:
        # country_iso3 IS NULL = événement global (§ data/events/wars.yaml),
        # concerne tous les pays du pool et doit apparaître dans leur filtre.
        stmt = stmt.where(
            or_(Event.country_iso3 == country.upper(), Event.country_iso3.is_(None))
        )
    if kind is not None:
        stmt = stmt.where(Event.kind == kind)
    if from_ is not None:
        stmt = stmt.where(Event.date_start >= dt.date(from_, 1, 1))
    if to is not None:
        stmt = stmt.where(Event.date_start <= dt.date(to, 12, 31))
    stmt = stmt.order_by(Event.date_start)
    return list(session.scalars(stmt).all())
