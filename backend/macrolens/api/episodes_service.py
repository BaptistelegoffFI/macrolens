"""Construction de la fiche d'épisode (GET /episodes/{country}/{year},
POST /compare — ADR 0004 §4/§5) : vecteur d'état + séries brutes en
fenêtre ±10 ans + événements chevauchant la même fenêtre. Hors core/ —
orchestration + accès DB."""

from __future__ import annotations

import datetime as dt

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from macrolens.api.routers.series import state_vector_out
from macrolens.api.schemas.episodes import EpisodeOut
from macrolens.api.schemas.events import EventOut
from macrolens.api.schemas.provenance import SourceRefOut
from macrolens.api.schemas.series import ObservationOut
from macrolens.db.models import Event, Observation, Source
from macrolens.panel import RAW_INDICATORS, BuiltPool

EPISODE_WINDOW_YEARS = 10


def build_episode(
    session: Session, built: BuiltPool, country: str, year: int, reference_frame: str
) -> EpisodeOut:
    country = country.upper()
    state = state_vector_out(session, built, country, year, reference_frame)

    window_start = dt.date(year - EPISODE_WINDOW_YEARS, 1, 1)
    window_end = dt.date(year + EPISODE_WINDOW_YEARS, 12, 31)

    obs_rows = session.scalars(
        select(Observation)
        .where(
            Observation.country_iso3 == country,
            Observation.indicator_code.in_(RAW_INDICATORS),
            Observation.freq == "A",
            Observation.period_start >= window_start,
            Observation.period_start <= window_end,
        )
        .order_by(Observation.indicator_code, Observation.period_start)
    ).all()
    series: dict[str, list[ObservationOut]] = {code: [] for code in RAW_INDICATORS}
    for row in obs_rows:
        series[row.indicator_code].append(ObservationOut.model_validate(row))

    event_rows = session.scalars(
        select(Event)
        .where(
            or_(Event.country_iso3 == country, Event.country_iso3.is_(None)),
            Event.date_start <= window_end,
            or_(Event.date_end.is_(None), Event.date_end >= window_start),
        )
        .order_by(Event.date_start)
    ).all()
    events = [EventOut.model_validate(row) for row in event_rows]

    source_ids = sorted({row.source_id for row in obs_rows})
    sources = sorted(
        (
            SourceRefOut(id=s.id, citation=s.citation, url=s.url, licence=s.licence)
            for s in session.scalars(select(Source).where(Source.id.in_(source_ids))).all()
        ),
        key=lambda s: s.id,
    )

    return EpisodeOut(
        country=country, year=year, state=state, series=series, events=events, sources=sources
    )
