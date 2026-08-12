"""Moteur de réconciliation (§5.3) : priorité de source, jamais de moyenne,
écart > 5% flagué conflict=true des deux côtés, valeur écartée conservée
dans observations_alt avec son motif.

Toutes les années de test sont > 2020 (dernière année JST) pour ne jamais
entrer en collision avec des observations JST réellement ingérées — sinon
un test pourrait silencieusement écraser une vraie valeur JST le temps de
sa transaction (annulée en fin de test, mais fragile et trompeur)."""

import datetime as dt

import pandas as pd
import pytest
from sqlalchemy import select
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from macrolens.db.models import Observation, ObservationAlt
from macrolens.db.session import make_engine
from macrolens.etl.reconcile import reconcile_and_load


@pytest.fixture
def db_session():  # type: ignore[no-untyped-def]
    engine = make_engine()
    try:
        connection = engine.connect()
    except OperationalError:
        pytest.skip("aucune base joignable au DATABASE_URL courant")
    connection.close()
    session = Session(engine)
    yield session
    session.rollback()
    session.close()


def _row(country: str, indicator: str, year: int, value: float, source_id: str) -> pd.DataFrame:
    return pd.DataFrame(
        [
            {
                "country_iso3": country,
                "indicator_code": indicator,
                "period_start": pd.Timestamp(year=year, month=1, day=1),
                "freq": "A",
                "value": value,
                "source_id": source_id,
                "is_interpolated": False,
                "is_break": False,
                "locator": {"kind": "test", "obs_index": 0, "variables": ["x"]},
                "raw_value_text": str(value),
                "transform_chain": ["parse_dta_float"],
            }
        ]
    )


def test_higher_priority_source_wins_and_loser_is_archived(db_session: Session) -> None:
    # cpi (imf_weo, priority 70) arrive en premier, puis jst (priority 100).
    reconcile_and_load(db_session, _row("FRA", "cpi", 2031, 100.0, "imf_weo"), raw_file_id=None)
    reconcile_and_load(db_session, _row("FRA", "cpi", 2031, 101.0, "jst"), raw_file_id=None)
    db_session.flush()

    kept = db_session.execute(
        select(Observation).where(
            Observation.country_iso3 == "FRA",
            Observation.indicator_code == "cpi",
            Observation.period_start == dt.date(2031, 1, 1),
        )
    ).scalar_one()
    assert kept.source_id == "jst"
    assert kept.value == 101.0

    archived = db_session.execute(
        select(ObservationAlt).where(
            ObservationAlt.country_iso3 == "FRA",
            ObservationAlt.indicator_code == "cpi",
            ObservationAlt.period_start == dt.date(2031, 1, 1),
            ObservationAlt.source_id == "imf_weo",
        )
    ).scalar_one()
    assert archived.value == 100.0
    assert "priorité inférieure" in archived.rejected_reason


def test_lower_priority_candidate_loses_and_is_archived(db_session: Session) -> None:
    # jst (100) déjà en place, un candidat owid (30) arrive ensuite : il perd.
    reconcile_and_load(
        db_session, _row("ITA", "unemployment_rate", 2032, 9.0, "jst"), raw_file_id=None
    )
    reconcile_and_load(
        db_session, _row("ITA", "unemployment_rate", 2032, 9.2, "owid"), raw_file_id=None
    )
    db_session.flush()

    kept = db_session.execute(
        select(Observation).where(
            Observation.country_iso3 == "ITA",
            Observation.indicator_code == "unemployment_rate",
            Observation.period_start == dt.date(2032, 1, 1),
        )
    ).scalar_one()
    assert kept.source_id == "jst"
    assert kept.value == 9.0

    archived = db_session.execute(
        select(ObservationAlt).where(
            ObservationAlt.country_iso3 == "ITA",
            ObservationAlt.indicator_code == "unemployment_rate",
            ObservationAlt.source_id == "owid",
        )
    ).scalar_one()
    assert archived.value == 9.2


def test_large_gap_flags_conflict_on_both_sides(db_session: Session) -> None:
    reconcile_and_load(
        db_session, _row("SWE", "debt_public_gdp", 2033, 40.0, "imf_weo"), raw_file_id=None
    )
    report = reconcile_and_load(
        db_session, _row("SWE", "debt_public_gdp", 2033, 55.0, "jst"), raw_file_id=None
    )
    db_session.flush()

    assert len(report.conflicts) == 1
    assert report.conflicts[0].relative_gap == pytest.approx(0.375)  # |55-40|/40

    kept = db_session.execute(
        select(Observation).where(
            Observation.country_iso3 == "SWE",
            Observation.indicator_code == "debt_public_gdp",
            Observation.period_start == dt.date(2033, 1, 1),
        )
    ).scalar_one()
    assert kept.conflict is True

    archived = db_session.execute(
        select(ObservationAlt).where(
            ObservationAlt.country_iso3 == "SWE",
            ObservationAlt.indicator_code == "debt_public_gdp",
            ObservationAlt.source_id == "imf_weo",
        )
    ).scalar_one()
    assert archived.conflict is True


def test_small_gap_does_not_flag_conflict(db_session: Session) -> None:
    reconcile_and_load(db_session, _row("NOR", "cpi", 2034, 100.0, "imf_weo"), raw_file_id=None)
    report = reconcile_and_load(
        db_session, _row("NOR", "cpi", 2034, 101.0, "jst"), raw_file_id=None
    )  # 1% d'écart, sous le seuil de 5%
    db_session.flush()

    assert len(report.conflicts) == 0
    kept = db_session.execute(
        select(Observation).where(
            Observation.country_iso3 == "NOR",
            Observation.indicator_code == "cpi",
            Observation.period_start == dt.date(2034, 1, 1),
        )
    ).scalar_one()
    assert kept.conflict is False


def test_same_source_rerun_is_a_plain_update_not_a_reconciliation(db_session: Session) -> None:
    reconcile_and_load(db_session, _row("DNK", "cpi", 2035, 100.0, "jst"), raw_file_id=None)
    report = reconcile_and_load(
        db_session, _row("DNK", "cpi", 2035, 100.5, "jst"), raw_file_id=None
    )
    db_session.flush()

    assert report.replaced_by_higher_priority == 0
    assert report.rejected_lower_priority == 0
    kept = db_session.execute(
        select(Observation).where(
            Observation.country_iso3 == "DNK",
            Observation.indicator_code == "cpi",
            Observation.period_start == dt.date(2035, 1, 1),
        )
    ).scalar_one()
    assert kept.value == 100.5
