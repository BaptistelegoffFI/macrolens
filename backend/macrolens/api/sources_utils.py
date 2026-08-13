"""§10 (Phase 5, critère d'acceptation) : « toute réponse contenant des
données porte un bloc de sources ». Calcule, pour un ensemble de couples
(pays, année), les sources qui ont réellement contribué (via
observations.source_id) — jamais une liste statique ou devinée."""

from __future__ import annotations

import datetime as dt

from sqlalchemy import select, tuple_
from sqlalchemy.orm import Session

from macrolens.api.schemas.provenance import SourceRefOut
from macrolens.db.models import Observation, Source


def sources_for_country_years(
    session: Session, pairs: list[tuple[str, int]], indicators: tuple[str, ...]
) -> list[SourceRefOut]:
    if not pairs:
        return []
    keys = [(country, dt.date(year, 1, 1)) for country, year in pairs]
    source_ids = session.scalars(
        select(Observation.source_id)
        .where(
            Observation.indicator_code.in_(indicators),
            tuple_(Observation.country_iso3, Observation.period_start).in_(keys),
        )
        .distinct()
    ).all()
    if not source_ids:
        return []
    sources = session.scalars(select(Source).where(Source.id.in_(source_ids))).all()
    return sorted(
        (
            SourceRefOut(id=s.id, citation=s.citation, url=s.url, licence=s.licence)
            for s in sources
        ),
        key=lambda s: s.id,
    )
