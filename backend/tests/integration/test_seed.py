"""Critères d'acceptation Phase 1 (§13) : `alembic upgrade head` puis
`macrolens seed` remplissent les référentiels. Ces tests nécessitent une base
au DATABASE_URL courant, déjà migrée et seedée (voir Makefile / CI) — ils se
sautent proprement si aucune base n'est joignable, pour ne pas casser un
`pytest` local sans Docker.
"""

import pytest
from sqlalchemy import func, select
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from macrolens.db.models import Country, Event, Indicator, Source
from macrolens.db.session import make_engine

CORE_COUNTRIES = {"FRA", "DEU", "ITA", "SWE", "FIN", "NOR"}


@pytest.fixture(scope="module")
def db_session():  # type: ignore[no-untyped-def]
    engine = make_engine()
    try:
        connection = engine.connect()
    except OperationalError:
        pytest.skip("aucune base joignable au DATABASE_URL courant")
    connection.close()
    with Session(engine) as session:
        yield session


def test_26_indicators_have_non_empty_french_definition(db_session: Session) -> None:
    indicators = db_session.scalars(select(Indicator)).all()
    assert len(indicators) == 26
    assert all(indicator.definition_fr.strip() for indicator in indicators)


def test_every_event_has_a_source_url(db_session: Session) -> None:
    events = db_session.scalars(select(Event)).all()
    assert len(events) > 0
    assert all(event.source_url.startswith("http") for event in events)


def test_17_countries_with_6_core(db_session: Session) -> None:
    countries = db_session.scalars(select(Country)).all()
    assert len(countries) == 17
    core = {c.iso3 for c in countries if c.is_core}
    assert core == CORE_COUNTRIES


def test_sources_catalog_loaded(db_session: Session) -> None:
    count = db_session.scalar(select(func.count()).select_from(Source))
    assert count == 16
