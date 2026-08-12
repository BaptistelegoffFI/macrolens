"""Critère Phase 3 : policy_rate est une couverture réellement nouvelle
(JST ne fournit pas cet indicateur — etl/mappings/jst.yaml `not_mapped`)."""

import datetime as dt

import pytest
from sqlalchemy import func, select
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from macrolens.db.models import Observation
from macrolens.db.session import make_engine


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


def test_policy_rate_has_observations(db_session: Session) -> None:
    count = db_session.scalar(
        select(func.count())
        .select_from(Observation)
        .where(Observation.indicator_code == "policy_rate", Observation.source_id == "bis_cbpol")
    )
    assert count is not None
    assert count > 0


def test_finland_policy_rate_starts_only_at_euro_adoption(db_session: Session) -> None:
    earliest = db_session.scalar(
        select(func.min(Observation.period_start)).where(
            Observation.indicator_code == "policy_rate", Observation.country_iso3 == "FIN"
        )
    )
    assert earliest is not None
    assert earliest >= dt.date(1999, 1, 1)


def test_sweden_policy_rate_predates_euro_adoption(db_session: Session) -> None:
    # SWE n'a jamais adopté l'euro : sa série nationale doit remonter avant 1999.
    earliest = db_session.scalar(
        select(func.min(Observation.period_start)).where(
            Observation.indicator_code == "policy_rate", Observation.country_iso3 == "SWE"
        )
    )
    assert earliest is not None
    assert earliest < dt.date(1999, 1, 1)
